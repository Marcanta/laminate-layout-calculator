import { effectiveRoomDims } from './laminateLayout'
import type { LayoutInputs, LayoutResult, PlankPiece, SummaryStats } from './types'

function cutoutAreaCm2(inputs: LayoutInputs): number {
  return inputs.cutouts.reduce((sum, c) => sum + Math.max(c.width, 0) * Math.max(c.height, 0), 0)
}

export function computeSummary(layout: LayoutResult, inputs: LayoutInputs): SummaryStats {
  const planks: PlankPiece[] = layout.planks

  const fullPlanksCount = planks.filter((p) => !p.isCut).length
  const cutPlanksCount = planks.filter((p) => p.isCut).length
  const clippedByObstacleCount = planks.filter((p) => p.isClippedByObstacle).length
  const totalPlanksUsed = fullPlanksCount + cutPlanksCount
  const planksToBuy = Math.ceil(totalPlanksUsed * (1 + inputs.wastePercent / 100))

  const effective = effectiveRoomDims(inputs.room, inputs.expansionGapCm)
  const roomAreaCm2 = effective.width * effective.length
  const netFloorAreaM2 = Math.max(roomAreaCm2 - cutoutAreaCm2(inputs), 0) / 10000
  const plankAreaM2 = (inputs.plank.length * inputs.plank.width) / 10000
  const coverageAreaM2 = totalPlanksUsed * plankAreaM2

  return {
    fullPlanksCount,
    cutPlanksCount,
    clippedByObstacleCount,
    totalPlanksUsed,
    planksToBuy,
    netFloorAreaM2,
    plankAreaM2,
    coverageAreaM2,
    warnings: layout.warnings,
  }
}
