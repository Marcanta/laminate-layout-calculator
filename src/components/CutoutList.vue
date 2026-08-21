<script setup lang="ts">
import type { CutoutInput } from '../lib/types'

defineProps<{ cutouts: CutoutInput[] }>()
const emit = defineEmits<{ add: []; remove: [id: string] }>()
</script>

<template>
  <fieldset class="form-section">
    <legend>Cutouts (islands, chimneys, etc.)</legend>
    <p v-if="cutouts.length === 0" class="hint">No cutouts. Add one to exclude a rectangular zone.</p>

    <div v-for="cutout in cutouts" :key="cutout.id" class="cutout-row">
      <label>
        X
        <input v-model.number="cutout.x" type="number" min="0" step="1" />
      </label>
      <label>
        Y
        <input v-model.number="cutout.y" type="number" min="0" step="1" />
      </label>
      <label>
        Width
        <input v-model.number="cutout.width" type="number" min="0" step="1" />
      </label>
      <label>
        Height
        <input v-model.number="cutout.height" type="number" min="0" step="1" />
      </label>
      <button type="button" class="remove-btn" @click="emit('remove', cutout.id)">Remove</button>
    </div>

    <button type="button" @click="emit('add')">Add cutout</button>
  </fieldset>
</template>
