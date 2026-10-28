import type { RGBA } from './color'
import { formatCssColor, parseColor } from './color'
import auroraShader from './vendor/aurora.wgsl?raw'
import calicoSwirlShader from './vendor/calico-swirl.wgsl?raw'
import campfireShader from './vendor/campfire.wgsl?raw'
import circularGradientShader from './vendor/circular-gradient.wgsl?raw'
import iridescenceShader from './vendor/iridescence.wgsl?raw'
import linearGradientShader from './vendor/linear-gradient.wgsl?raw'
import liquidChromeShader from './vendor/liquid-chrome.wgsl?raw'
import silkShader from './vendor/silk.wgsl?raw'

export const LIBRARY_VERSION = '0.3.0'
export const LIBRARY_COMMIT = '388bc530ffd01ad958acdfce0e40d36979a8ebe4'
export const LIBRARY_URL = 'https://github.com/blazejkustra/react-native-effects'

export type EffectId =
  | 'iridescence'
  | 'liquid-chrome'
  | 'silk'
  | 'campfire'
  | 'calico-swirl'
  | 'aurora'
  | 'linear-gradient'
  | 'circular-gradient'

export type ValueMap = Record<string, string | number>

export type NumberControl = {
  kind: 'number'
  key: string
  label: string
  default: number
  min: number
  max: number
  step: number
  unit?: string
}

export type ColorControl = {
  kind: 'color'
  key: string
  label: string
  default: string
  /** Which stop of a 5-color preset fills this input. */
  presetIndex: number
  alpha?: boolean
  defaultAlpha?: number
}

export type Control = NumberControl | ColorControl

export type EffectDef = {
  id: EffectId
  component: string
  label: string
  description: string
  note: string
  shader: string
  controls: Control[]
  animates: boolean
  isStatic: (values: ValueMap) => boolean
  shaderSpeed: (values: ValueMap) => number
  colors: (values: ValueMap) => string[]
  params: (values: ValueMap) => number[]
}

export type DrawState = {
  shaderId: EffectId
  shader: string
  color0: RGBA
  color1: RGBA
  params: number[]
  shaderSpeed: number
  paused: boolean
  isStatic: boolean
}

const animated = {
  animates: true,
  isStatic: () => false,
}

function speedOf(values: ValueMap): number {
  return Number(values.speed)
}

function colorOf(key: string, values: ValueMap, alphaKey?: string): string {
  const hex = String(values[key] ?? '#000000')
  if (!alphaKey) return hex
  return formatCssColor(hex, Number(values[alphaKey]))
}

export const EFFECTS: EffectDef[] = [
  {
    id: 'iridescence',
    component: 'Iridescence',
    label: 'Iridescence',
    description: 'Flowing rainbow field',
    note: 'Color multiplies the rainbow. White leaves it intact. A dark color dims the whole field.',
    shader: iridescenceShader,
    controls: [
      { kind: 'color', key: 'color', label: 'Color', default: '#ffffff', presetIndex: 3 },
      { kind: 'number', key: 'speed', label: 'Speed', default: 1, min: 0, max: 3, step: 0.01 },
    ],
    ...animated,
    shaderSpeed: speedOf,
    colors: (values) => [colorOf('color', values)],
    params: () => [],
  },
  {
    id: 'liquid-chrome',
    component: 'LiquidChrome',
    label: 'Liquid Chrome',
    description: 'Fluid metallic surface',
    note: 'Highlights come from dividing by a sine wave, so peaks go very bright. That is the upstream shader.',
    shader: liquidChromeShader,
    controls: [
      { kind: 'color', key: 'color', label: 'Color', default: '#1a1a1a', presetIndex: 1 },
      { kind: 'number', key: 'speed', label: 'Speed', default: 0.2, min: 0, max: 2, step: 0.01 },
      { kind: 'number', key: 'amplitude', label: 'Amplitude', default: 0.3, min: 0, max: 1.2, step: 0.01 },
      { kind: 'number', key: 'frequencyX', label: 'Frequency X', default: 3, min: 0, max: 8, step: 0.1 },
      { kind: 'number', key: 'frequencyY', label: 'Frequency Y', default: 3, min: 0, max: 8, step: 0.1 },
    ],
    ...animated,
    shaderSpeed: speedOf,
    colors: (values) => [colorOf('color', values)],
    params: (values) => [Number(values.amplitude), Number(values.frequencyX), Number(values.frequencyY)],
  },
  {
    id: 'silk',
    component: 'Silk',
    label: 'Silk',
    description: 'Flowing fabric',
    note: 'Rotation is in radians. Silk multiplies this color, so the folds are darker than the swatch. Light presets sit higher in the same screen color, short of white.',
    shader: silkShader,
    controls: [
      { kind: 'color', key: 'color', label: 'Color', default: '#7b7481', presetIndex: 2 },
      { kind: 'number', key: 'speed', label: 'Speed', default: 1, min: 0, max: 3, step: 0.01 },
      { kind: 'number', key: 'scale', label: 'Scale', default: 1, min: 0.25, max: 4, step: 0.01 },
      { kind: 'number', key: 'rotation', label: 'Rotation', default: 0, min: -3.14, max: 3.14, step: 0.01, unit: 'rad' },
      { kind: 'number', key: 'noiseIntensity', label: 'Noise', default: 1.5, min: 0, max: 5, step: 0.01 },
    ],
    ...animated,
    shaderSpeed: speedOf,
    colors: (values) => [colorOf('color', values)],
    params: (values) => [Number(values.scale), Number(values.rotation), Number(values.noiseIntensity)],
  },
  {
    id: 'campfire',
    component: 'Campfire',
    label: 'Campfire',
    description: 'Fire, sparks, and smoke',
    note: 'The flame is about 210 pixels tall, then smoke. The library example uses a 200px-high view, so a large preview leaves dark space above the fire.',
    shader: campfireShader,
    controls: [
      { kind: 'color', key: 'color', label: 'Color', default: '#ffffff', presetIndex: 3 },
      { kind: 'number', key: 'speed', label: 'Speed', default: 1, min: 0, max: 3, step: 0.01 },
      { kind: 'number', key: 'sparkSize', label: 'Spark size', default: 1, min: 0, max: 3, step: 0.01 },
      { kind: 'number', key: 'fireIntensity', label: 'Fire', default: 1, min: 0, max: 3, step: 0.01 },
      { kind: 'number', key: 'smokeIntensity', label: 'Smoke', default: 1, min: 0, max: 3, step: 0.01 },
    ],
    ...animated,
    shaderSpeed: speedOf,
    colors: (values) => [colorOf('color', values)],
    params: (values) => [Number(values.sparkSize), Number(values.fireIntensity), Number(values.smokeIntensity)],
  },
  {
    id: 'calico-swirl',
    component: 'CalicoSwirl',
    label: 'Calico Swirl',
    description: 'Warped flowing noise',
    note: 'Purple, red, gray, and blue are baked into the shader. Color multiplies that result.',
    shader: calicoSwirlShader,
    controls: [
      { kind: 'color', key: 'color', label: 'Color', default: '#ffffff', presetIndex: 3 },
      { kind: 'number', key: 'speed', label: 'Speed', default: 1, min: 0, max: 3, step: 0.01 },
      { kind: 'number', key: 'intensity', label: 'Intensity', default: 1, min: 0, max: 3, step: 0.01 },
    ],
    ...animated,
    shaderSpeed: speedOf,
    colors: (values) => [colorOf('color', values)],
    params: (values) => [Number(values.intensity)],
  },
  {
    id: 'aurora',
    component: 'Aurora',
    label: 'Aurora',
    description: 'Curtains of light',
    note: 'Green, cyan, purple, and pink curtains are inside the shader. Color is a multiply tint, so a dark tint hides the lights.',
    shader: auroraShader,
    controls: [
      { kind: 'color', key: 'color', label: 'Color', default: '#4ade80', presetIndex: 3 },
      { kind: 'number', key: 'speed', label: 'Speed', default: 1, min: 0, max: 3, step: 0.01 },
      { kind: 'number', key: 'intensity', label: 'Intensity', default: 1, min: 0, max: 3, step: 0.01 },
      { kind: 'number', key: 'layers', label: 'Layers', default: 3, min: 1, max: 5, step: 1 },
      { kind: 'number', key: 'waviness', label: 'Waviness', default: 1, min: 0, max: 3, step: 0.01 },
    ],
    ...animated,
    shaderSpeed: speedOf,
    colors: (values) => [colorOf('color', values)],
    params: (values) => [Number(values.intensity), Number(values.layers), Number(values.waviness)],
  },
  {
    id: 'linear-gradient',
    component: 'LinearGradient',
    label: 'Linear Gradient',
    description: 'Two-color ramp',
    note: 'Speed is degrees per second, not the time scale used by the other effects. 0 draws one static frame.',
    shader: linearGradientShader,
    controls: [
      { kind: 'color', key: 'startColor', label: 'Start', default: '#ff0000', presetIndex: 0 },
      { kind: 'color', key: 'endColor', label: 'End', default: '#0000ff', presetIndex: 3 },
      { kind: 'number', key: 'angle', label: 'Angle', default: 45, min: 0, max: 360, step: 1, unit: 'deg' },
      { kind: 'number', key: 'speed', label: 'Rotation speed', default: 0, min: 0, max: 180, step: 1, unit: '°/s' },
    ],
    animates: true,
    isStatic: (values) => Number(values.speed) === 0,
    shaderSpeed: (values) => (Number(values.speed) === 0 ? 0 : 1),
    colors: (values) => [colorOf('startColor', values), colorOf('endColor', values)],
    params: (values) => [Number(values.angle), Number(values.speed)],
  },
  {
    id: 'circular-gradient',
    component: 'CircularGradient',
    label: 'Circular Gradient',
    description: 'Radial ramp',
    note: 'This shader does not animate. Edge alpha 0 is the component default: a transparent edge.',
    shader: circularGradientShader,
    controls: [
      { kind: 'color', key: 'centerColor', label: 'Center', default: '#ffffff', presetIndex: 3 },
      {
        kind: 'color',
        key: 'edgeColor',
        label: 'Edge',
        default: '#000000',
        presetIndex: 0,
        alpha: true,
        defaultAlpha: 0,
      },
      { kind: 'number', key: 'centerX', label: 'Center X', default: 0.5, min: 0, max: 1, step: 0.01 },
      { kind: 'number', key: 'centerY', label: 'Center Y', default: 0.5, min: 0, max: 1, step: 0.01 },
      { kind: 'number', key: 'sizeX', label: 'Radius X', default: 0.5, min: 0.05, max: 1.5, step: 0.01 },
      { kind: 'number', key: 'sizeY', label: 'Radius Y', default: 0.5, min: 0.05, max: 1.5, step: 0.01 },
    ],
    animates: false,
    isStatic: () => true,
    shaderSpeed: () => 0,
    colors: (values) => [
      colorOf('centerColor', values),
      colorOf('edgeColor', values, 'edgeColorAlpha'),
    ],
    params: (values) => [
      Number(values.centerX),
      Number(values.centerY),
      Number(values.sizeX),
      Number(values.sizeY),
    ],
  },
]

const byId = new Map(EFFECTS.map((effect) => [effect.id, effect]))

export function getEffect(id: EffectId): EffectDef {
  const effect = byId.get(id)
  if (!effect) throw new Error(`Unknown effect ${id}`)
  return effect
}

export function isEffectId(value: string): value is EffectId {
  return byId.has(value as EffectId)
}

export function defaultValues(effect: EffectDef): ValueMap {
  const values: ValueMap = {}
  for (const control of effect.controls) {
    values[control.key] = control.default
    if (control.kind === 'color' && control.alpha) {
      values[`${control.key}Alpha`] = control.defaultAlpha ?? 1
    }
  }
  return values
}

export function quantize(value: number, min: number, max: number, step: number): number {
  const clamped = Math.min(max, Math.max(min, value))
  if (step <= 0) return clamped
  const steps = Math.round((clamped - min) / step)
  const snapped = min + steps * step
  const places = step >= 1 ? 0 : (String(step).split('.')[1]?.length ?? 2)
  return Number(snapped.toFixed(Math.min(places, 4)))
}

export function buildDrawState(effect: EffectDef, values: ValueMap, paused: boolean): DrawState {
  const cssColors = effect.colors(values)
  const params = [0, 0, 0, 0, 0, 0, 0, 0]
  effect.params(values).forEach((value, index) => {
    if (index < 8) params[index] = value
  })
  return {
    shaderId: effect.id,
    shader: effect.shader,
    color0: cssColors[0] ? parseColor(cssColors[0]) : [0, 0, 0, 0],
    color1: cssColors[1] ? parseColor(cssColors[1]) : [0, 0, 0, 0],
    params,
    shaderSpeed: effect.shaderSpeed(values),
    paused,
    isStatic: effect.isStatic(values),
  }
}

export type Palette = {
  id: string
  screen: string
  tone: 'Dark' | 'Light'
  colors: [string, string, string, string, string]
}

/** Screen colors from the cockpit, lifted so Silk's middle stop is not a dark fold. Stops stay short of white. */
export const PALETTES = [
  { id: 'home-dark', screen: 'Home', tone: 'Dark', colors: ['#0b5337', '#0e5e3e', '#116945', '#15744d', '#177e53'] },
  { id: 'home-light', screen: 'Home', tone: 'Light', colors: ['#1f9362', '#26a46e', '#2db67b', '#33c385', '#37ce8d'] },
  { id: 'sell-dark', screen: 'Sell', tone: 'Dark', colors: ['#aa5117', '#b2581b', '#ba5f20', '#c26724', '#ca6d28'] },
  { id: 'sell-light', screen: 'Sell', tone: 'Light', colors: ['#d37932', '#da833b', '#e18e45', '#e6954c', '#eb9c53'] },
  { id: 'freelance-dark', screen: 'Freelance', tone: 'Dark', colors: ['#243394', '#29399d', '#2e3fa6', '#3445af', '#384ab6'] },
  { id: 'freelance-light', screen: 'Freelance', tone: 'Light', colors: ['#4357c5', '#4d62d0', '#586ddc', '#5f76e5', '#667dec'] },
  { id: 'build-dark', screen: 'Build', tone: 'Dark', colors: ['#5e23ba', '#6429c2', '#6b2fcb', '#7135d4', '#773bdb'] },
  { id: 'build-light', screen: 'Build', tone: 'Light', colors: ['#814be5', '#8a5aea', '#9369ef', '#9a75f3', '#a07ff6'] },
  { id: 'recover-dark', screen: 'Recover', tone: 'Dark', colors: ['#0c6861', '#0f7069', '#117971', '#148179', '#178980'] },
  { id: 'recover-light', screen: 'Recover', tone: 'Light', colors: ['#1e988f', '#26a59b', '#2db2a8', '#33bcb2', '#37c5ba'] },
] as const satisfies readonly Palette[]

export type PresetId = (typeof PALETTES)[number]['id'] | 'custom'

export function isPresetId(value: string): value is PresetId {
  return value === 'custom' || PALETTES.some((palette) => palette.id === value)
}

export function applyPreset(effect: EffectDef, values: ValueMap, palette: Palette): ValueMap {
  const next = { ...values }
  for (const control of effect.controls) {
    if (control.kind !== 'color') continue
    next[control.key] = palette.colors[control.presetIndex]
    if (control.alpha) next[`${control.key}Alpha`] = 1
  }
  return next
}

export const FRAMES = [
  { id: 'square', label: 'Square', detail: '1:1' },
  { id: 'portrait', label: 'Portrait', detail: '9:16' },
  { id: 'landscape', label: 'Landscape', detail: '16:9' },
  { id: 'full', label: 'Full width', detail: 'Fill' },
] as const

export type FrameId = (typeof FRAMES)[number]['id']

export function isFrameId(value: string): value is FrameId {
  return FRAMES.some((frame) => frame.id === value)
}
