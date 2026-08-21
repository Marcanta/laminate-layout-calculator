<script setup lang="ts">
import { ref } from 'vue'
import type { SavedLayout } from '../lib/types'

const props = defineProps<{ savedLayouts: SavedLayout[]; saveError: string | null }>()
const emit = defineEmits<{ save: [name: string]; load: [id: string]; delete: [id: string] }>()

const nameInput = ref('')

function onSave() {
  const name = nameInput.value.trim()
  if (!name) return
  emit('save', name)
  if (!props.saveError) {
    nameInput.value = ''
  }
}

function onDelete(item: SavedLayout) {
  if (!confirm(`Delete saved layout "${item.name}"?`)) return
  emit('delete', item.id)
}
</script>

<template>
  <fieldset class="form-section">
    <legend>Saved layouts</legend>
    <p v-if="savedLayouts.length === 0" class="hint">No saved layouts yet.</p>

    <ul v-else class="saved-layouts-list">
      <li v-for="item in savedLayouts" :key="item.id">
        <span>
          <span class="saved-layout-name">{{ item.name }}</span>
          <span class="saved-layout-date">{{ new Date(item.createdAt).toLocaleString() }}</span>
        </span>
        <span class="saved-layout-actions">
          <button type="button" @click="emit('load', item.id)">Load</button>
          <button type="button" class="remove-btn" @click="onDelete(item)">Delete</button>
        </span>
      </li>
    </ul>

    <div class="save-row">
      <input v-model="nameInput" type="text" aria-label="Layout name" placeholder="Layout name" @keyup.enter="onSave" />
      <button type="button" :disabled="!nameInput.trim()" @click="onSave">Save current layout</button>
    </div>
    <p v-if="saveError" class="error-text">{{ saveError }}</p>
  </fieldset>
</template>
