import { computed, reactive, ref } from 'vue'
import { generateLayout } from '../lib/laminateLayout'
import { randomSeed } from '../lib/rng'
import { computeSummary } from '../lib/summary'
import type { CutoutInput, LayoutInputs, Orientation } from '../lib/types'

let cutoutCounter = 0
function nextCutoutId(): string {
  cutoutCounter += 1
  return `cutout-${cutoutCounter}`
}

export function useLaminateLayout() {
  const inputs = reactive<LayoutInputs>({
    room: { width: 400, length: 300 },
    expansionGapCm: 1,
    cutouts: [],
    plank: { length: 120, width: 19 },
    minOffsetCm: 30,
    minPlankLengthCm: 40,
    minPlankWidthCm: 5,
    wastePercent: 8,
    orientation: 'along-length' as Orientation,
  })

  const seed = ref(randomSeed())

  function addCutout() {
    inputs.cutouts.push({ id: nextCutoutId(), x: 0, y: 0, width: 0, height: 0 })
  }

  function removeCutout(id: string) {
    const idx = inputs.cutouts.findIndex((c: CutoutInput) => c.id === id)
    if (idx !== -1) inputs.cutouts.splice(idx, 1)
  }

  function regenerate() {
    seed.value = randomSeed()
  }

  const layout = computed(() => generateLayout(inputs, seed.value))
  const summary = computed(() => computeSummary(layout.value, inputs))

  return { inputs, layout, summary, addCutout, removeCutout, regenerate }
}
