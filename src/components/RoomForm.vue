<script setup lang="ts">
import type { LayoutInputs } from '../lib/types'

defineProps<{ inputs: LayoutInputs }>()
</script>

<template>
  <fieldset class="form-section">
    <legend>Room</legend>
    <label>
      Width (cm)
      <input v-model.number="inputs.room.width" type="number" min="1" step="1" />
    </label>
    <label>
      Length (cm)
      <input v-model.number="inputs.room.length" type="number" min="1" step="1" />
    </label>
    <label>
      Expansion gap (cm)
      <input v-model.number="inputs.expansionGapCm" type="number" min="0" step="0.1" />
    </label>
    <p class="hint">Clearance left between the plank edges and each wall for thermal expansion. Typical range: 0.8–1.5cm (8–15mm).</p>
  </fieldset>

  <fieldset class="form-section">
    <legend>Plank</legend>
    <label>
      Length (cm)
      <input v-model.number="inputs.plank.length" type="number" min="1" step="1" />
    </label>
    <label>
      Width (cm)
      <input v-model.number="inputs.plank.width" type="number" min="1" step="1" />
    </label>
    <label>
      Minimum plank length (cm)
      <input v-model.number="inputs.minPlankLengthCm" type="number" min="0" step="1" />
    </label>
    <label>
      Minimum plank width (cm)
      <input v-model.number="inputs.minPlankWidthCm" type="number" min="0" step="1" />
    </label>
  </fieldset>

  <fieldset class="form-section">
    <legend>Layout options</legend>
    <label>
      Orientation
      <select v-model="inputs.orientation">
        <option value="along-length">Planks run along room length</option>
        <option value="along-width">Planks run along room width</option>
      </select>
    </label>
    <label>
      Minimum joint offset (cm)
      <input v-model.number="inputs.minOffsetCm" type="number" min="0" step="1" />
    </label>
    <label>
      Purchase waste margin (%)
      <input v-model.number="inputs.wastePercent" type="number" min="0" step="1" />
    </label>
  </fieldset>
</template>
