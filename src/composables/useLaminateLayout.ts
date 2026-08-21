import { computed, reactive, ref } from 'vue'
import { generateLayout } from '../lib/laminateLayout'
import { randomSeed } from '../lib/rng'
import { deleteSavedLayout, getSavedLayout, listSavedLayouts, upsertSavedLayout } from '../lib/savedLayouts'
import { computeSummary } from '../lib/summary'
import type { CutoutInput, LayoutInputs, ManualRowInput, Orientation, SavedLayout } from '../lib/types'

let cutoutCounter = 0
function nextCutoutId(): string {
  cutoutCounter += 1
  return `cutout-${cutoutCounter}`
}

let manualRowCounter = 0
function nextManualRowId(): string {
  manualRowCounter += 1
  return `manual-row-${manualRowCounter}`
}

export function useLaminateLayout() {
  const inputs = reactive<LayoutInputs>({
    room: { width: 400, length: 300 },
    expansionGapCm: 1,
    cutouts: [],
    manualRows: [],
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

  function addManualRow() {
    inputs.manualRows.push({ id: nextManualRowId(), firstCutCm: inputs.plank.length })
  }

  function removeManualRow(id: string) {
    const idx = inputs.manualRows.findIndex((r: ManualRowInput) => r.id === id)
    if (idx !== -1) inputs.manualRows.splice(idx, 1)
  }

  function regenerate() {
    seed.value = randomSeed()
  }

  const savedLayouts = ref<SavedLayout[]>(listSavedLayouts())
  const saveError = ref<string | null>(null)

  function saveLayout(name: string) {
    if (!name.trim()) return
    try {
      upsertSavedLayout(name, inputs, seed.value)
      savedLayouts.value = listSavedLayouts()
      saveError.value = null
    } catch (err) {
      saveError.value = err instanceof Error ? err.message : 'Could not save layout.'
    }
  }

  function loadLayout(id: string) {
    const record = getSavedLayout(id)
    if (!record) return
    const r = record.inputs

    inputs.room.width = r.room.width
    inputs.room.length = r.room.length
    inputs.expansionGapCm = r.expansionGapCm
    inputs.plank.length = r.plank.length
    inputs.plank.width = r.plank.width
    inputs.minOffsetCm = r.minOffsetCm
    inputs.minPlankLengthCm = r.minPlankLengthCm
    inputs.minPlankWidthCm = r.minPlankWidthCm
    inputs.wastePercent = r.wastePercent
    inputs.orientation = r.orientation

    inputs.cutouts.splice(0, inputs.cutouts.length, ...r.cutouts.map((c) => ({ ...c, id: nextCutoutId() })))
    inputs.manualRows.splice(
      0,
      inputs.manualRows.length,
      ...r.manualRows.map((m) => ({ ...m, id: nextManualRowId() })),
    )

    seed.value = record.seed
  }

  function deleteLayout(id: string) {
    deleteSavedLayout(id)
    savedLayouts.value = listSavedLayouts()
  }

  const layout = computed(() => generateLayout(inputs, seed.value))
  const summary = computed(() => computeSummary(layout.value, inputs))

  return {
    inputs,
    layout,
    summary,
    addCutout,
    removeCutout,
    addManualRow,
    removeManualRow,
    regenerate,
    savedLayouts,
    saveError,
    saveLayout,
    loadLayout,
    deleteLayout,
  }
}
