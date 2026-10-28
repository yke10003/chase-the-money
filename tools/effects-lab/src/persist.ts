import { normalizeHex } from './color'
import {
  EFFECTS,
  defaultValues,
  isEffectId,
  isFrameId,
  isPresetId,
  quantize,
  type EffectId,
  type FrameId,
  type PresetId,
  type ValueMap,
} from './catalog'

const STORAGE_KEY = 'nolume-effects-lab'

export type StageTone = 'dark' | 'light'

export type LabState = {
  effectId: EffectId
  values: Record<EffectId, ValueMap>
  presets: Record<EffectId, PresetId>
  frame: FrameId
  stage: StageTone
  paused: boolean
  overlay: boolean
}

export function createDefaultState(): LabState {
  const values = {} as Record<EffectId, ValueMap>
  const presets = {} as Record<EffectId, PresetId>
  for (const effect of EFFECTS) {
    values[effect.id] = defaultValues(effect)
    presets[effect.id] = 'custom'
  }
  return {
    effectId: 'iridescence',
    values,
    presets,
    frame: 'square',
    stage: 'dark',
    paused: false,
    overlay: false,
  }
}

export function loadState(): LabState {
  const defaults = createDefaultState()
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return defaults
    const parsed = JSON.parse(raw) as Partial<LabState>
    const effectId = typeof parsed.effectId === 'string' && isEffectId(parsed.effectId)
      ? parsed.effectId
      : defaults.effectId
    const values = { ...defaults.values }
    const presets = { ...defaults.presets }
    for (const effect of EFFECTS) {
      const savedValues = parsed.values?.[effect.id]
      values[effect.id] = sanitizeValues(effect.id, savedValues)
      const savedPreset = parsed.presets?.[effect.id]
      if (typeof savedPreset === 'string' && isPresetId(savedPreset)) {
        presets[effect.id] = savedPreset
      }
    }
    return {
      effectId,
      values,
      presets,
      frame: typeof parsed.frame === 'string' && isFrameId(parsed.frame) ? parsed.frame : defaults.frame,
      stage: parsed.stage === 'light' ? 'light' : 'dark',
      paused: parsed.paused === true,
      overlay: parsed.overlay === true,
    }
  } catch (error) {
    console.warn('[effects-lab] Ignoring saved configuration:', error)
    return defaults
  }
}

export function saveState(state: LabState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}

function sanitizeValues(id: EffectId, raw: unknown): ValueMap {
  const effect = EFFECTS.find((item) => item.id === id)
  if (!effect) return {}
  const values = defaultValues(effect)
  if (!raw || typeof raw !== 'object') return values
  const record = raw as Record<string, unknown>
  for (const control of effect.controls) {
    if (control.kind === 'number') {
      const value = record[control.key]
      if (typeof value === 'number' && Number.isFinite(value)) {
        values[control.key] = quantize(value, control.min, control.max, control.step)
      }
      continue
    }
    const color = record[control.key]
    if (typeof color === 'string') {
      const hex = normalizeHex(color)
      if (hex) values[control.key] = hex
    }
    if (control.alpha) {
      const alpha = record[`${control.key}Alpha`]
      if (typeof alpha === 'number' && Number.isFinite(alpha)) {
        values[`${control.key}Alpha`] = quantize(alpha, 0, 1, 0.01)
      }
    }
  }
  return values
}
