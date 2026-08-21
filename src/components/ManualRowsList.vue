<script setup lang="ts">
import type { ManualRowInput } from '../lib/types'

defineProps<{ manualRows: ManualRowInput[] }>()
const emit = defineEmits<{ add: []; remove: [id: string] }>()
</script>

<template>
  <fieldset class="form-section">
    <legend>Manual rows (already installed)</legend>
    <p v-if="manualRows.length === 0" class="hint">
      No manual rows. Add one per row you've already installed, starting from row 1, and enter its
      first-plank cut length — the rest of that row and all following rows are generated automatically.
    </p>

    <div v-for="(row, index) in manualRows" :key="row.id" class="manual-row">
      <label>
        Row {{ index + 1 }} first-cut length (cm)
        <input v-model.number="row.firstCutCm" type="number" min="0" step="1" />
      </label>
      <button type="button" class="remove-btn" @click="emit('remove', row.id)">Remove</button>
    </div>

    <button type="button" @click="emit('add')">Add manual row</button>
  </fieldset>
</template>
