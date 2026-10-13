import type { ComponentConfig } from 'shaders/js'

export type Surface = 'plastic' | 'glass'

export type VectorShape = {
  id: string
  kind: 'ellipse' | 'circle' | 'ring'
  /** 0–1, origin top-left, matching the shader UV space. */
  cx: number
  cy: number
  /** Radii in UV units. 0.5 reaches the canvas edge from the center. */
  rx: number
  ry: number
  /** Degrees. 0 keeps the long axis vertical. */
  rotation: number
  colorA: string
  colorB: string
  /** When set, Plastic uses this multi-stop gradient instead of colorA/colorB. */
  stops?: { color: string; position: number }[]
  opacity: number
  /** Added to the global light angle so neighboring shapes don't share a highlight. */
  lightOffset: number
  /** Body is shaded plastic. Lens is a refractive overlay and is not a filled shape. */
  role: 'body' | 'lens'
  surface: Surface
}

export type Mark = {
  components: ComponentConfig[]
  vectors: VectorShape[]
  background: string
  accent: string
}

export type Params = {
  background: string
  colors: string[]
  count: number
  spacing: number
  scale: number
  rotation: number
  gloss: number
  highlight: number
  transparency: number
  softness: number
  inflation: number
  light: number
}

export type SliderKey =
  | 'count'
  | 'spacing'
  | 'scale'
  | 'rotation'
  | 'gloss'
  | 'highlight'
  | 'transparency'
  | 'softness'
  | 'inflation'
  | 'light'

export type SliderSpec = {
  key: SliderKey
  label: string
  min: number
  max: number
  step: number
}

export type Concept = {
  id: string
  letter: string
  name: string
  filename: string
  summary: string
  defaults: Params
  sliders: SliderSpec[]
  compose: (params: Params) => Mark
}

export type RenderMode = 'shader' | 'paint'

export type PackFile = {
  name: string
  base64: string
}
