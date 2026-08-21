<script setup lang="ts">
import type { SummaryStats } from '../lib/types'

defineProps<{ summary: SummaryStats }>()
</script>

<template>
  <fieldset class="form-section">
    <legend>Summary</legend>
    <ul class="summary-list">
      <li><span>Full planks</span><strong>{{ summary.fullPlanksCount }}</strong></li>
      <li><span>Cut planks</span><strong>{{ summary.cutPlanksCount }}</strong></li>
      <li v-if="summary.clippedByObstacleCount > 0">
        <span>Planks cut around an obstacle</span><strong>{{ summary.clippedByObstacleCount }}</strong>
      </li>
      <li><span>Total planks used</span><strong>{{ summary.totalPlanksUsed }}</strong></li>
      <li v-if="summary.offcutsReusedCount > 0">
        <span>Offcuts reused</span><strong>{{ summary.offcutsReusedCount }}</strong>
      </li>
      <li class="highlight"><span>Planks to buy (incl. waste)</span><strong>{{ summary.planksToBuy }}</strong></li>
      <li><span>Net floor area</span><strong>{{ summary.netFloorAreaM2.toFixed(2) }} m²</strong></li>
      <li><span>Plank area</span><strong>{{ summary.plankAreaM2.toFixed(3) }} m²</strong></li>
      <li><span>Coverage (with cuts)</span><strong>{{ summary.coverageAreaM2.toFixed(2) }} m²</strong></li>
    </ul>

    <p class="hint">
      Purchase estimate assumes 1 fresh plank per piece shown, except pieces marked as
      reused offcuts — those reuse material left over from an earlier row's cuts instead of
      a new board.
    </p>

    <ul v-if="summary.warnings.length" class="warnings">
      <li v-for="(w, i) in summary.warnings" :key="i">{{ w }}</li>
    </ul>
  </fieldset>
</template>
