<script setup lang="ts">
import CutoutList from './components/CutoutList.vue'
import LayoutSvg from './components/LayoutSvg.vue'
import ManualRowsList from './components/ManualRowsList.vue'
import RoomForm from './components/RoomForm.vue'
import SavedLayoutsPanel from './components/SavedLayoutsPanel.vue'
import SummaryPanel from './components/SummaryPanel.vue'
import { useLaminateLayout } from './composables/useLaminateLayout'

const {
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
} = useLaminateLayout()
</script>

<template>
  <div class="app">
    <aside class="sidebar">
      <h1>Laminate layout generator</h1>
      <p class="subtitle">Pose à joints perdus — randomized staggered pattern</p>

      <RoomForm :inputs="inputs" />
      <ManualRowsList :manual-rows="inputs.manualRows" @add="addManualRow" @remove="removeManualRow" />
      <CutoutList :cutouts="inputs.cutouts" @add="addCutout" @remove="removeCutout" />

      <button type="button" class="regenerate-btn" @click="regenerate">Re-randomize layout</button>

      <SavedLayoutsPanel
        :saved-layouts="savedLayouts"
        :save-error="saveError"
        @save="saveLayout"
        @load="loadLayout"
        @delete="deleteLayout"
      />

      <SummaryPanel :summary="summary" />
    </aside>

    <main class="canvas-area">
      <LayoutSvg
        :room="inputs.room"
        :expansion-gap-cm="inputs.expansionGapCm"
        :cutouts="inputs.cutouts"
        :planks="layout.planks"
      />
    </main>
  </div>
</template>
