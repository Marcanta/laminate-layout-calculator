import type { CutoutInput, LayoutInputs, ManualRowInput, PlankInput, RoomInput, SavedLayout } from './types'

const STORAGE_KEY = 'laminate-layout-calculator:saved-layouts:v1'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isValidRoomInput(value: unknown): value is RoomInput {
  if (!isRecord(value)) return false
  return typeof value.width === 'number' && typeof value.length === 'number'
}

function isValidPlankInput(value: unknown): value is PlankInput {
  if (!isRecord(value)) return false
  return typeof value.length === 'number' && typeof value.width === 'number'
}

function isValidCutoutInput(value: unknown): value is CutoutInput {
  if (!isRecord(value)) return false
  return (
    typeof value.id === 'string' &&
    typeof value.x === 'number' &&
    typeof value.y === 'number' &&
    typeof value.width === 'number' &&
    typeof value.height === 'number'
  )
}

function isValidManualRowInput(value: unknown): value is ManualRowInput {
  if (!isRecord(value)) return false
  return typeof value.id === 'string' && typeof value.firstCutCm === 'number'
}

function isValidLayoutInputs(value: unknown): value is LayoutInputs {
  if (!isRecord(value)) return false
  return (
    isValidRoomInput(value.room) &&
    typeof value.expansionGapCm === 'number' &&
    Array.isArray(value.cutouts) &&
    value.cutouts.every(isValidCutoutInput) &&
    Array.isArray(value.manualRows) &&
    value.manualRows.every(isValidManualRowInput) &&
    isValidPlankInput(value.plank) &&
    typeof value.minOffsetCm === 'number' &&
    typeof value.minPlankLengthCm === 'number' &&
    typeof value.minPlankWidthCm === 'number' &&
    typeof value.wastePercent === 'number' &&
    (value.orientation === 'along-length' || value.orientation === 'along-width')
  )
}

function isValidSavedLayout(value: unknown): value is SavedLayout {
  if (!isRecord(value)) return false
  return (
    typeof value.id === 'string' &&
    typeof value.name === 'string' &&
    typeof value.createdAt === 'number' &&
    typeof value.seed === 'number' &&
    isValidLayoutInputs(value.inputs)
  )
}

function readAll(): SavedLayout[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(isValidSavedLayout)
  } catch {
    return []
  }
}

function writeAll(layouts: SavedLayout[]): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(layouts))
    return true
  } catch {
    return false
  }
}

function createId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `save-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export function listSavedLayouts(): SavedLayout[] {
  return readAll().sort((a, b) => b.createdAt - a.createdAt)
}

export function getSavedLayout(id: string): SavedLayout | undefined {
  return readAll().find((layout) => layout.id === id)
}

export function upsertSavedLayout(name: string, inputs: LayoutInputs, seed: number): SavedLayout {
  const trimmedName = name.trim()
  const layouts = readAll()
  const existing = layouts.find((layout) => layout.name === trimmedName)

  const record: SavedLayout = {
    id: existing?.id ?? createId(),
    name: trimmedName,
    createdAt: Date.now(),
    inputs: JSON.parse(JSON.stringify(inputs)) as LayoutInputs,
    seed,
  }

  const next = existing ? layouts.map((layout) => (layout.id === record.id ? record : layout)) : [...layouts, record]
  if (!writeAll(next)) {
    throw new Error('Could not save layout: local storage is unavailable or full.')
  }
  return record
}

export function deleteSavedLayout(id: string): void {
  writeAll(readAll().filter((layout) => layout.id !== id))
}
