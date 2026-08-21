import { describe, expect, it } from 'vitest'
import { computeSummary } from './summary'
import type { LayoutInputs, LayoutResult, PlankPiece } from './types'

function plank(overrides: Partial<PlankPiece>): PlankPiece {
  return {
    id: 'p',
    row: 0,
    x: 0,
    y: 0,
    width: 19,
    height: 120,
    isCut: false,
    isClippedByObstacle: false,
    ...overrides,
  }
}

describe('computeSummary', () => {
  const inputs: LayoutInputs = {
    room: { width: 400, length: 300 },
    expansionGapCm: 0,
    cutouts: [],
    plank: { length: 120, width: 19 },
    minOffsetCm: 30,
    minPlankLengthCm: 40,
    minPlankWidthCm: 5,
    wastePercent: 10,
    orientation: 'along-length',
  }

  it('counts full vs cut planks and totals them', () => {
    const layout: LayoutResult = {
      planks: [plank({ isCut: false }), plank({ isCut: true }), plank({ isCut: true })],
      rows: 1,
      seed: 1,
      warnings: [],
    }
    const summary = computeSummary(layout, inputs)
    expect(summary.fullPlanksCount).toBe(1)
    expect(summary.cutPlanksCount).toBe(2)
    expect(summary.totalPlanksUsed).toBe(3)
  })

  it('applies the waste percentage with rounding up', () => {
    const layout: LayoutResult = {
      planks: Array.from({ length: 9 }, () => plank({})),
      rows: 1,
      seed: 1,
      warnings: [],
    }
    const summary = computeSummary(layout, inputs)
    // 9 * 1.10 = 9.9 -> rounds up to 10
    expect(summary.planksToBuy).toBe(10)
  })

  it('computes area stats from room, cutouts, and plank dimensions', () => {
    const inputsWithCutout: LayoutInputs = {
      ...inputs,
      cutouts: [{ id: 'c1', x: 0, y: 0, width: 100, height: 100 }],
    }
    const layout: LayoutResult = { planks: [plank({})], rows: 1, seed: 1, warnings: [] }
    const summary = computeSummary(layout, inputsWithCutout)

    const expectedNetArea = (400 * 300 - 100 * 100) / 10000
    expect(summary.netFloorAreaM2).toBeCloseTo(expectedNetArea, 6)
    expect(summary.plankAreaM2).toBeCloseTo((120 * 19) / 10000, 6)
    expect(summary.coverageAreaM2).toBeCloseTo(summary.plankAreaM2 * 1, 6)
  })

  it('shrinks net floor area by the expansion gap band', () => {
    const inputsWithGap: LayoutInputs = { ...inputs, expansionGapCm: 10 }
    const layout: LayoutResult = { planks: [plank({})], rows: 1, seed: 1, warnings: [] }
    const summary = computeSummary(layout, inputsWithGap)

    const expectedNetArea = (380 * 280) / 10000
    expect(summary.netFloorAreaM2).toBeCloseTo(expectedNetArea, 6)
  })
})
