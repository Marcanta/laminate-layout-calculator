import { describe, expect, it } from 'vitest'
import { effectiveRoomDims, generateLayout } from './laminateLayout'
import type { LayoutInputs } from './types'

function baseInputs(overrides: Partial<LayoutInputs> = {}): LayoutInputs {
  return {
    room: { width: 400, length: 300 },
    expansionGapCm: 0,
    cutouts: [],
    manualRows: [],
    plank: { length: 120, width: 19 },
    minOffsetCm: 30,
    minPlankLengthCm: 40,
    minPlankWidthCm: 5,
    wastePercent: 8,
    orientation: 'along-length',
    ...overrides,
  }
}

function circularOffset(a: number, b: number, plankLength: number): number {
  let d = (a - b) % plankLength
  if (d < 0) d += plankLength
  return Math.min(d, plankLength - d)
}

function firstCutsByRow(inputs: LayoutInputs, planks: ReturnType<typeof generateLayout>['planks']) {
  const runIsLength = inputs.orientation === 'along-length'
  const byRow = new Map<number, typeof planks>()
  for (const p of planks) {
    if (!byRow.has(p.row)) byRow.set(p.row, [])
    byRow.get(p.row)!.push(p)
  }
  const firstCuts: number[] = []
  for (const [, rowPlanks] of [...byRow.entries()].sort((a, b) => a[0] - b[0])) {
    const sorted = [...rowPlanks].sort((a, b) => (runIsLength ? a.y - b.y : a.x - b.x))
    firstCuts.push(runIsLength ? sorted[0].height : sorted[0].width)
  }
  return firstCuts
}

describe('generateLayout', () => {
  it('respects the minimum joint offset between adjacent rows, or warns if relaxed', () => {
    const inputs = baseInputs()
    const result = generateLayout(inputs, 42)
    const firstCuts = firstCutsByRow(inputs, result.planks)
    for (let i = 1; i < firstCuts.length; i++) {
      const dist = circularOffset(firstCuts[i], firstCuts[i - 1], inputs.plank.length)
      if (dist < inputs.minOffsetCm - 1e-6) {
        expect(result.warnings.length).toBeGreaterThan(0)
      }
    }
  })

  it('keeps every plank within the room bounds', () => {
    const inputs = baseInputs()
    const result = generateLayout(inputs, 7)
    for (const p of result.planks) {
      expect(p.x).toBeGreaterThanOrEqual(-1e-6)
      expect(p.y).toBeGreaterThanOrEqual(-1e-6)
      expect(p.x + p.width).toBeLessThanOrEqual(inputs.room.width + 1e-6)
      expect(p.y + p.height).toBeLessThanOrEqual(inputs.room.length + 1e-6)
    }
  })

  it('excludes planks fully inside a cutout', () => {
    const inputs = baseInputs({
      cutouts: [{ id: 'c1', x: 0, y: 0, width: 400, height: 300 }],
    })
    const result = generateLayout(inputs, 3)
    expect(result.planks.length).toBe(0)
  })

  it('fills a row exactly, even when room dims are not a multiple of plank dims', () => {
    const inputs = baseInputs({ room: { width: 407, length: 253 } })
    const result = generateLayout(inputs, 11)
    const runIsLength = inputs.orientation === 'along-length'
    const byRow = new Map<number, number>()
    for (const p of result.planks) {
      const len = runIsLength ? p.height : p.width
      byRow.set(p.row, (byRow.get(p.row) ?? 0) + len)
    }
    const runAxisLength = runIsLength ? inputs.room.length : inputs.room.width
    for (const total of byRow.values()) {
      expect(total).toBeCloseTo(runAxisLength, 3)
    }
  })

  it('produces a single truncated plank when the plank is longer than the room', () => {
    const inputs = baseInputs({
      room: { width: 100, length: 80 },
      plank: { length: 200, width: 19 },
    })
    const result = generateLayout(inputs, 1)
    const runIsLength = inputs.orientation === 'along-length'
    const byRow = new Map<number, number>()
    for (const p of result.planks) {
      byRow.set(p.row, (byRow.get(p.row) ?? 0) + 1)
    }
    for (const count of byRow.values()) {
      expect(count).toBe(1)
    }
    const runAxisLength = runIsLength ? inputs.room.length : inputs.room.width
    for (const p of result.planks) {
      const len = runIsLength ? p.height : p.width
      expect(len).toBeCloseTo(runAxisLength, 3)
      expect(p.isCut).toBe(true)
    }
  })

  it('omits every plank in a row fully spanned by a cutout', () => {
    // orientation 'along-length': row 0 is the vertical strip x in [0, 19], spanning
    // the full room length in y — so a cutout covering that whole strip removes the row.
    const inputs = baseInputs({
      room: { width: 400, length: 300 },
      cutouts: [{ id: 'c1', x: 0, y: 0, width: 19, height: 300 }],
    })
    const result = generateLayout(inputs, 5)
    expect(result.planks.some((p) => p.row === 0)).toBe(false)
  })

  it('is deterministic for a given seed', () => {
    const inputs = baseInputs()
    const a = generateLayout(inputs, 999)
    const b = generateLayout(inputs, 999)
    expect(a.planks).toEqual(b.planks)
  })

  it('does not crash and warns when the minimum offset is infeasible', () => {
    const inputs = baseInputs({ minOffsetCm: 1000 })
    const result = generateLayout(inputs, 2)
    expect(result.planks.length).toBeGreaterThan(0)
    expect(result.warnings.length).toBeGreaterThan(0)
  })

  it('never crashes or hangs on tiny/degenerate plank dimensions', () => {
    const inputs = baseInputs({
      plank: { length: 5, width: 3 },
      minOffsetCm: 50,
      minPlankLengthCm: 100,
      minPlankWidthCm: 100,
    })
    expect(() => generateLayout(inputs, 1)).not.toThrow()
  })

  it('does not crash and warns when the minimum plank length exceeds the plank length', () => {
    const inputs = baseInputs({ minPlankLengthCm: 500 }) // plank.length is 120
    const result = generateLayout(inputs, 2)
    expect(result.planks.length).toBeGreaterThan(0)
    expect(result.warnings.length).toBeGreaterThan(0)
  })

  it('redistributes the first and last rows so neither is narrower than the minimum plank width', () => {
    // plankWidth 19, room.width 290 -> naive rows: 15 x 19cm + 1 x 5cm.
    const inputs = baseInputs({ room: { width: 290, length: 300 }, minPlankWidthCm: 8 })
    const result = generateLayout(inputs, 1)
    const rowWidths = new Map<number, number>()
    for (const p of result.planks) rowWidths.set(p.row, p.width)
    const widths = [...rowWidths.entries()].sort((a, b) => a[0] - b[0]).map(([, w]) => w)
    expect(widths[0]).toBeGreaterThanOrEqual(8 - 1e-6)
    expect(widths[widths.length - 1]).toBeGreaterThanOrEqual(8 - 1e-6)
    for (let i = 1; i < widths.length - 1; i++) expect(widths[i]).toBeCloseTo(19, 6)
    expect(result.warnings.length).toBeGreaterThan(0)
  })

  it('does not crash and warns when the minimum plank width cannot be satisfied even by redistribution', () => {
    const inputs = baseInputs({ room: { width: 290, length: 300 }, minPlankWidthCm: 15 })
    const result = generateLayout(inputs, 1)
    expect(result.planks.length).toBeGreaterThan(0)
    expect(result.warnings.length).toBeGreaterThan(0)
  })

  it('does not crash and warns when the minimum plank width exceeds the plank width', () => {
    const inputs = baseInputs({ minPlankWidthCm: 1000 }) // plank.width is 19
    const result = generateLayout(inputs, 1)
    expect(result.planks.length).toBeGreaterThan(0)
    expect(result.warnings.length).toBeGreaterThan(0)
  })

  it('insets every plank from the walls by the expansion gap', () => {
    const gap = 1.5
    const inputs = baseInputs({ room: { width: 400, length: 300 }, expansionGapCm: gap })
    const result = generateLayout(inputs, 11)
    expect(result.planks.length).toBeGreaterThan(0)

    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    let maxY = -Infinity
    for (const p of result.planks) {
      expect(p.x).toBeGreaterThanOrEqual(gap - 1e-6)
      expect(p.y).toBeGreaterThanOrEqual(gap - 1e-6)
      expect(p.x + p.width).toBeLessThanOrEqual(inputs.room.width - gap + 1e-6)
      expect(p.y + p.height).toBeLessThanOrEqual(inputs.room.length - gap + 1e-6)
      minX = Math.min(minX, p.x)
      minY = Math.min(minY, p.y)
      maxX = Math.max(maxX, p.x + p.width)
      maxY = Math.max(maxY, p.y + p.height)
    }
    expect(minX).toBeCloseTo(gap, 6)
    expect(minY).toBeCloseTo(gap, 6)
    expect(maxX).toBeCloseTo(inputs.room.width - gap, 6)
    expect(maxY).toBeCloseTo(inputs.room.length - gap, 6)
  })

  it('warns and produces no planks when the expansion gap leaves no usable floor area', () => {
    const inputs = baseInputs({ room: { width: 10, length: 10 }, expansionGapCm: 6 })
    const result = generateLayout(inputs, 1)
    expect(result.planks.length).toBe(0)
    expect(result.warnings.some((w) => w.toLowerCase().includes('expansion gap'))).toBe(true)
  })
})

describe('generateLayout manual rows', () => {
  it('applies manual first-cut lengths exactly and flags those planks as manual', () => {
    const inputs = baseInputs({
      manualRows: [
        { id: 'm1', firstCutCm: 60 },
        { id: 'm2', firstCutCm: 90 },
      ],
    })
    const result = generateLayout(inputs, 1)
    const firstCuts = firstCutsByRow(inputs, result.planks)
    expect(firstCuts[0]).toBeCloseTo(60, 6)
    expect(firstCuts[1]).toBeCloseTo(90, 6)

    for (const p of result.planks) {
      expect(p.isManual).toBe(p.row === 0 || p.row === 1)
    }
  })

  it('seeds prevFirstCut for the first auto-generated row from the last manual row', () => {
    const inputs = baseInputs({
      room: { width: 400, length: 350 },
      minOffsetCm: 60, // exactly plankLength / 2 — the max achievable offset, a measure-zero target
      manualRows: [{ id: 'm1', firstCutCm: 50 }],
    })
    const result = generateLayout(inputs, 1)
    const firstCuts = firstCutsByRow(inputs, result.planks)
    expect(firstCuts[0]).toBeCloseTo(50, 6)
    // (50 + 120/2) % 120 = 110 — the deterministic tier-3 fallback in pickFirstCut
    expect(firstCuts[1]).toBeCloseTo(110, 6)
    expect(result.warnings.some((w) => w.includes('deterministic maximum-offset placement'))).toBe(true)
  })

  it('ignores manual rows beyond the number of physical rows, with a warning', () => {
    const inputs = baseInputs({
      room: { width: 20, length: 300 },
      minPlankWidthCm: 5,
      manualRows: [
        { id: 'm1', firstCutCm: 60 },
        { id: 'm2', firstCutCm: 60 },
        { id: 'm3', firstCutCm: 60 },
        { id: 'm4', firstCutCm: 60 },
        { id: 'm5', firstCutCm: 60 },
      ],
    })
    expect(() => generateLayout(inputs, 1)).not.toThrow()
    const result = generateLayout(inputs, 1)
    expect(result.rows).toBe(2)
    expect(result.warnings.some((w) => w.includes('manual row'))).toBe(true)
  })

  it('preserves a manual first-cut that violates constraints, but warns instead of replacing it', () => {
    const inputs = baseInputs({
      room: { width: 400, length: 249 },
      manualRows: [{ id: 'm1', firstCutCm: 5 }],
    })
    const result = generateLayout(inputs, 1)
    const firstCuts = firstCutsByRow(inputs, result.planks)
    expect(firstCuts[0]).toBeCloseTo(5, 6)
    expect(result.warnings.length).toBeGreaterThan(0)
  })

  it('falls back to a full plank when a manual first-cut is not positive, with a warning', () => {
    const inputs = baseInputs({
      manualRows: [{ id: 'm1', firstCutCm: 0 }],
    })
    const result = generateLayout(inputs, 1)
    const firstCuts = firstCutsByRow(inputs, result.planks)
    expect(firstCuts[0]).toBeCloseTo(inputs.plank.length, 6)
    expect(result.warnings.some((w) => w.includes('must be a positive number'))).toBe(true)
  })
})

describe('effectiveRoomDims', () => {
  it('subtracts the gap from both sides of each axis', () => {
    expect(effectiveRoomDims({ width: 400, length: 300 }, 10)).toEqual({ width: 380, length: 280 })
  })

  it('clamps a negative gap to zero', () => {
    expect(effectiveRoomDims({ width: 400, length: 300 }, -5)).toEqual({ width: 400, length: 300 })
  })

  it('floors each axis at zero when the gap exceeds half the dimension', () => {
    expect(effectiveRoomDims({ width: 10, length: 300 }, 20)).toEqual({ width: 0, length: 260 })
  })
})
