export interface RoomInput {
  width: number
  length: number
}

export interface CutoutInput {
  id: string
  x: number
  y: number
  width: number
  height: number
}

export interface ManualRowInput {
  id: string
  firstCutCm: number
}

export interface PlankInput {
  length: number
  width: number
}

export type Orientation = 'along-length' | 'along-width'

export interface LayoutInputs {
  room: RoomInput
  expansionGapCm: number
  cutouts: CutoutInput[]
  manualRows: ManualRowInput[]
  plank: PlankInput
  minOffsetCm: number
  minPlankLengthCm: number
  minPlankWidthCm: number
  wastePercent: number
  orientation: Orientation
}

export interface PlankPiece {
  id: string
  row: number
  x: number
  y: number
  width: number
  height: number
  isCut: boolean
  isClippedByObstacle: boolean
  isManual: boolean
}

export interface LayoutResult {
  planks: PlankPiece[]
  rows: number
  seed: number
  warnings: string[]
}

export interface SummaryStats {
  fullPlanksCount: number
  cutPlanksCount: number
  clippedByObstacleCount: number
  totalPlanksUsed: number
  planksToBuy: number
  netFloorAreaM2: number
  plankAreaM2: number
  coverageAreaM2: number
  warnings: string[]
}
