import { mulberry32 } from './rng'
import { rectFullyInside, rectsOverlap, type Rect } from './geometry'
import type { CutoutInput, LayoutInputs, LayoutResult, Orientation, PlankPiece, RoomInput } from './types'

const EPS = 1e-6
const MAX_SAMPLE_ATTEMPTS = 200
const MIN_CANDIDATE_FLOOR = 1 // cm, keeps relaxed sampling from picking a near-zero length

export function effectiveRoomDims(room: RoomInput, expansionGapCm: number): RoomInput {
  const gap = Math.max(expansionGapCm, 0)
  return {
    width: Math.max(room.width - 2 * gap, 0),
    length: Math.max(room.length - 2 * gap, 0),
  }
}

function circularOffset(a: number, b: number, plankLength: number): number {
  let d = (a - b) % plankLength
  if (d < 0) d += plankLength
  return Math.min(d, plankLength - d)
}

function isSliverValid(candidate: number, runAxisLength: number, plankLength: number, minFragmentCm: number): boolean {
  const clamped = Math.min(candidate, runAxisLength)
  const remaining = runAxisLength - clamped
  if (remaining <= EPS) return true
  const lastCut = remaining % plankLength
  if (lastCut <= EPS) return true
  return lastCut >= minFragmentCm - EPS
}

interface PickFirstCutParams {
  rowIndex: number
  runAxisLength: number
  plankLength: number
  minFragmentCm: number
  effectiveMinOffset: number
  prevFirstCut: number | null
  rand: () => number
  warnings: string[]
}

function pickFirstCut(params: PickFirstCutParams): number {
  const { rowIndex, runAxisLength, plankLength, minFragmentCm, effectiveMinOffset, prevFirstCut, rand, warnings } = params

  const offsetOk = (candidate: number) =>
    prevFirstCut === null || circularOffset(candidate, prevFirstCut, plankLength) >= effectiveMinOffset - EPS

  // Attempt 1: respect both the sliver rule and the joint-offset rule.
  const lo1 = Math.min(minFragmentCm, plankLength)
  const span1 = Math.max(plankLength - lo1, 0)
  for (let i = 0; i < MAX_SAMPLE_ATTEMPTS; i++) {
    const candidate = lo1 + rand() * span1
    if (isSliverValid(candidate, runAxisLength, plankLength, minFragmentCm) && offsetOk(candidate)) {
      return candidate
    }
  }

  // Attempt 2: drop the sliver rule, keep the joint-offset rule.
  const span2 = Math.max(plankLength - MIN_CANDIDATE_FLOOR, 0)
  for (let i = 0; i < MAX_SAMPLE_ATTEMPTS; i++) {
    const candidate = MIN_CANDIDATE_FLOOR + rand() * span2
    if (offsetOk(candidate)) {
      if (prevFirstCut !== null) {
        warnings.push(
          `Row ${rowIndex + 1}: allowed a shorter-than-usual end cut to keep the minimum joint offset.`,
        )
      }
      return candidate
    }
  }

  // Attempt 3: deterministic fallback — place the joint at maximum achievable circular
  // distance from the previous row. Always satisfies offsetOk since effectiveMinOffset <= plankLength / 2.
  if (prevFirstCut !== null) {
    let fallback = (prevFirstCut + plankLength / 2) % plankLength
    if (fallback < MIN_CANDIDATE_FLOOR) fallback = plankLength / 2
    warnings.push(
      `Row ${rowIndex + 1}: could not find a random offset satisfying the constraints after ${MAX_SAMPLE_ATTEMPTS} attempts — used a deterministic maximum-offset placement instead.`,
    )
    return fallback
  }

  return Math.min(minFragmentCm, plankLength)
}

function buildRect(
  orientation: Orientation,
  rowOffset: number,
  posAlongRun: number,
  rowThickness: number,
  lenAlongRun: number,
): Rect {
  if (orientation === 'along-length') {
    return { x: rowOffset, y: posAlongRun, width: rowThickness, height: lenAlongRun }
  }
  return { x: posAlongRun, y: rowOffset, width: lenAlongRun, height: rowThickness }
}

function classifyAgainstCutouts(rect: Rect, cutouts: CutoutInput[]): { omit: boolean; clipped: boolean } {
  let clipped = false
  for (const cutout of cutouts) {
    if (rectFullyInside(rect, cutout)) {
      return { omit: true, clipped: true }
    }
    if (rectsOverlap(rect, cutout)) {
      clipped = true
    }
  }
  return { omit: false, clipped }
}

function applyMinRowWidth(
  rowThicknesses: number[],
  plankWidth: number,
  minPlankWidthCm: number,
  warnings: string[],
): number[] {
  if (rowThicknesses.length === 0) return rowThicknesses
  const lastIdx = rowThicknesses.length - 1
  const last = rowThicknesses[lastIdx]
  if (last >= minPlankWidthCm - EPS) return rowThicknesses

  if (lastIdx === 0) {
    warnings.push(
      `Row 1 is ${last.toFixed(1)}cm wide, narrower than the minimum plank width of ${minPlankWidthCm.toFixed(1)}cm — the room is too narrow to satisfy the constraint.`,
    )
    return rowThicknesses
  }

  const firstIdx = 0
  const combined = rowThicknesses[firstIdx] + last
  if (combined < 2 * minPlankWidthCm - EPS) {
    warnings.push(
      `Row ${lastIdx + 1} is ${last.toFixed(1)}cm wide, narrower than the minimum plank width of ${minPlankWidthCm.toFixed(1)}cm, and redistributing width from the first row wasn't enough to fix it.`,
    )
    return rowThicknesses
  }

  const half = Math.min(combined / 2, plankWidth)
  const other = combined - half
  const updated = [...rowThicknesses]
  updated[firstIdx] = half
  updated[lastIdx] = other
  warnings.push(
    `Row 1 and row ${lastIdx + 1} were trimmed to ${half.toFixed(1)}cm / ${other.toFixed(1)}cm (at the room's opposite edges) so neither is narrower than the minimum plank width of ${minPlankWidthCm.toFixed(1)}cm.`,
  )
  return updated
}

export function generateLayout(inputs: LayoutInputs, seed: number): LayoutResult {
  const { room, expansionGapCm, cutouts, plank, minOffsetCm, minPlankLengthCm, minPlankWidthCm, orientation } = inputs
  const warnings: string[] = []

  const plankLength = plank.length
  const plankWidth = plank.width

  if (!(room.width > 0) || !(room.length > 0) || !(plankLength > 0) || !(plankWidth > 0)) {
    return { planks: [], rows: 0, seed, warnings: ['Room and plank dimensions must be positive numbers.'] }
  }

  const gap = Math.max(expansionGapCm, 0)
  const effective = effectiveRoomDims(room, gap)
  const runAxisLength = orientation === 'along-length' ? effective.length : effective.width
  const rowAxisLength = orientation === 'along-length' ? effective.width : effective.length

  if (!(runAxisLength > 0) || !(rowAxisLength > 0)) {
    return {
      planks: [],
      rows: 0,
      seed,
      warnings: [
        `Expansion gap of ${gap.toFixed(1)}cm per side leaves no usable floor area in a ${room.width}cm x ${room.length}cm room — reduce the expansion gap.`,
      ],
    }
  }

  const rand = mulberry32(seed)

  let minFragmentCm = minPlankLengthCm
  if (minFragmentCm < 0) minFragmentCm = 0
  if (minFragmentCm > plankLength) {
    minFragmentCm = plankLength
    warnings.push(
      `Minimum plank length reduced to ${plankLength}cm — the requested ${minPlankLengthCm}cm exceeds the full plank length (${plankLength}cm) and can never be achieved.`,
    )
  }

  let effectiveMinPlankWidthCm = minPlankWidthCm
  if (effectiveMinPlankWidthCm < 0) effectiveMinPlankWidthCm = 0
  if (effectiveMinPlankWidthCm > plankWidth) {
    effectiveMinPlankWidthCm = plankWidth
    warnings.push(
      `Minimum plank width reduced to ${plankWidth}cm — the requested ${minPlankWidthCm}cm exceeds the full plank width (${plankWidth}cm) and can never be achieved.`,
    )
  }

  let effectiveMinOffset = minOffsetCm
  const maxOffset = plankLength / 2
  if (effectiveMinOffset > maxOffset) {
    effectiveMinOffset = maxOffset
    warnings.push(
      `Minimum offset reduced to ${maxOffset.toFixed(1)}cm — the requested ${minOffsetCm}cm exceeds half the plank length (${plankLength}cm) and can never be achieved.`,
    )
  }
  if (effectiveMinOffset < 0) effectiveMinOffset = 0

  const rawRowThicknesses: number[] = []
  let consumedRow = 0
  while (consumedRow < rowAxisLength - EPS) {
    const remaining = rowAxisLength - consumedRow
    const thickness = remaining >= plankWidth ? plankWidth : remaining
    rawRowThicknesses.push(thickness)
    consumedRow += thickness
  }
  const rowThicknesses = applyMinRowWidth(rawRowThicknesses, plankWidth, effectiveMinPlankWidthCm, warnings)

  const planks: PlankPiece[] = []
  let prevFirstCut: number | null = null
  let rowOffset = 0

  rowThicknesses.forEach((rowThickness, rowIndex) => {
    const firstCut = pickFirstCut({
      rowIndex,
      runAxisLength,
      plankLength,
      minFragmentCm,
      effectiveMinOffset,
      prevFirstCut,
      rand,
      warnings,
    })
    prevFirstCut = firstCut

    let pos = 0
    let isFirstPlank = true
    let plankIndex = 0
    while (pos < runAxisLength - EPS) {
      const remaining = runAxisLength - pos
      const nominalLen = isFirstPlank ? firstCut : plankLength
      const len = Math.min(nominalLen, remaining)
      isFirstPlank = false

      const localRect = buildRect(orientation, rowOffset, pos, rowThickness, len)
      const rect: Rect = { x: localRect.x + gap, y: localRect.y + gap, width: localRect.width, height: localRect.height }
      const { omit, clipped } = classifyAgainstCutouts(rect, cutouts)

      if (!omit) {
        const isCut = len < plankLength - EPS || rowThickness < plankWidth - EPS || clipped
        planks.push({
          id: `row${rowIndex}-p${plankIndex}`,
          row: rowIndex,
          x: rect.x,
          y: rect.y,
          width: rect.width,
          height: rect.height,
          isCut,
          isClippedByObstacle: clipped,
        })
      }

      plankIndex += 1
      pos += len
    }

    rowOffset += rowThickness
  })

  return { planks, rows: rowThicknesses.length, seed, warnings }
}
