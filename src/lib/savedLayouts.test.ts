import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { deleteSavedLayout, getSavedLayout, listSavedLayouts, upsertSavedLayout } from './savedLayouts'
import type { LayoutInputs } from './types'

function createMemoryStorage(): Storage {
  const store = new Map<string, string>()
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value)
    },
    removeItem: (key: string) => {
      store.delete(key)
    },
    clear: () => store.clear(),
    key: (index: number) => Array.from(store.keys())[index] ?? null,
    get length() {
      return store.size
    },
  }
}

const inputs: LayoutInputs = {
  room: { width: 400, length: 300 },
  expansionGapCm: 1,
  cutouts: [],
  manualRows: [],
  plank: { length: 120, width: 19 },
  minOffsetCm: 30,
  minPlankLengthCm: 40,
  minPlankWidthCm: 5,
  wastePercent: 8,
  orientation: 'along-length',
}

describe('savedLayouts', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', createMemoryStorage())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns an empty list when nothing has been saved', () => {
    expect(listSavedLayouts()).toEqual([])
  })

  it('creates a new record and lists it', () => {
    const record = upsertSavedLayout('Living room', inputs, 42)
    expect(listSavedLayouts()).toEqual([record])
    expect(record.name).toBe('Living room')
    expect(record.seed).toBe(42)
  })

  it('overwrites an existing record when saved under the same name', () => {
    const first = upsertSavedLayout('Living room', inputs, 1)
    const second = upsertSavedLayout('Living room', { ...inputs, wastePercent: 12 }, 2)

    expect(second.id).toBe(first.id)
    expect(listSavedLayouts()).toHaveLength(1)
    expect(listSavedLayouts()[0].seed).toBe(2)
  })

  it('trims the name before saving', () => {
    const record = upsertSavedLayout('  Kitchen  ', inputs, 1)
    expect(record.name).toBe('Kitchen')
  })

  it('gets a record by id, or undefined when missing', () => {
    const record = upsertSavedLayout('Living room', inputs, 1)
    expect(getSavedLayout(record.id)).toEqual(record)
    expect(getSavedLayout('missing')).toBeUndefined()
  })

  it('deletes a record by id', () => {
    const record = upsertSavedLayout('Living room', inputs, 1)
    deleteSavedLayout(record.id)
    expect(listSavedLayouts()).toEqual([])
  })

  it('returns an empty list when stored JSON is corrupt', () => {
    localStorage.setItem('laminate-layout-calculator:saved-layouts:v1', '{not json')
    expect(listSavedLayouts()).toEqual([])
  })

  it('filters out malformed entries but keeps valid ones', () => {
    const record = upsertSavedLayout('Living room', inputs, 1)
    const raw = JSON.parse(localStorage.getItem('laminate-layout-calculator:saved-layouts:v1')!)
    raw.push({ id: 'bad', name: 'missing fields' })
    localStorage.setItem('laminate-layout-calculator:saved-layouts:v1', JSON.stringify(raw))

    expect(listSavedLayouts()).toEqual([record])
  })

  it('filters out entries with empty or malformed inputs', () => {
    const record = upsertSavedLayout('Living room', inputs, 1)
    const raw = JSON.parse(localStorage.getItem('laminate-layout-calculator:saved-layouts:v1')!)
    raw.push({ id: 'bad-inputs', name: 'bad inputs', createdAt: 1, seed: 1, inputs: {} })
    localStorage.setItem('laminate-layout-calculator:saved-layouts:v1', JSON.stringify(raw))

    expect(listSavedLayouts()).toEqual([record])
  })

  it('filters out entries whose inputs have malformed array elements', () => {
    const record = upsertSavedLayout('Living room', inputs, 1)
    const raw = JSON.parse(localStorage.getItem('laminate-layout-calculator:saved-layouts:v1')!)
    raw.push({
      id: 'bad-cutout',
      name: 'bad cutout',
      createdAt: 1,
      seed: 1,
      inputs: { ...inputs, cutouts: [{ id: 'x' }] },
    })
    localStorage.setItem('laminate-layout-calculator:saved-layouts:v1', JSON.stringify(raw))

    expect(listSavedLayouts()).toEqual([record])
  })

  it('throws when localStorage is unavailable so failures are not silently swallowed', () => {
    vi.stubGlobal('localStorage', undefined)
    expect(listSavedLayouts()).toEqual([])
    expect(() => upsertSavedLayout('Living room', inputs, 1)).toThrow()
  })

  it('throws when localStorage.setItem fails (e.g. quota exceeded) and does not persist', () => {
    const setItemSpy = vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError')
    })

    expect(() => upsertSavedLayout('Living room', inputs, 1)).toThrow()

    setItemSpy.mockRestore()
    expect(listSavedLayouts()).toEqual([])
  })
})
