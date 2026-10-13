import type { ComponentConfig } from 'shaders/js'
import { clamp, mixHex, petalColors, samplePalette, shade } from './color'
import type { Concept, Mark, Params, SliderSpec, VectorShape } from './types'

const materialSliders: SliderSpec[] = [
  { key: 'gloss', label: 'Gloss', min: 0, max: 1, step: 0.01 },
  { key: 'highlight', label: 'Highlight', min: 0, max: 1, step: 0.01 },
  { key: 'transparency', label: 'Transparency', min: 0, max: 1, step: 0.01 },
  { key: 'softness', label: 'Edge softness', min: 0, max: 0.08, step: 0.001 },
  { key: 'inflation', label: 'Inflation', min: 0.15, max: 1, step: 0.01 },
  { key: 'light', label: 'Light angle', min: 0, max: 360, step: 1 },
]

function form(
  count: SliderSpec | null,
  spacing: SliderSpec,
  scale: SliderSpec,
  rotation: SliderSpec,
): SliderSpec[] {
  const sliders = [spacing, scale, rotation]
  if (count) sliders.unshift(count)
  return [...sliders, ...materialSliders]
}

function opacityOf(params: Params): number {
  return clamp(1 - params.transparency * 0.72, 0.22, 1)
}

function roughnessOf(params: Params): number {
  return clamp(0.62 - params.gloss * 0.34, 0.2, 0.75)
}

function place(angleDeg: number, orbit: number): { x: number; y: number } {
  const rad = (angleDeg * Math.PI) / 180
  return {
    x: 0.5 + Math.cos(rad) * orbit,
    y: 0.5 + Math.sin(rad) * orbit,
  }
}

function rotatePoint(x: number, y: number, deg: number): { x: number; y: number } {
  const rad = (deg * Math.PI) / 180
  const cos = Math.cos(rad)
  const sin = Math.sin(rad)
  return { x: x * cos - y * sin, y: x * sin + y * cos }
}

function backdrop(params: Params, accent: string): ComponentConfig[] {
  const lifted = mixHex(params.background, '#ffffff', 0.22)
  const spot = mixHex(lifted, accent, 0.2)
  return [
    { id: 'bg', type: 'SolidColor', props: { color: params.background } },
    {
      id: 'field',
      type: 'RadialGradient',
      props: {
        colorA: spot,
        colorB: params.background,
        center: { x: 0.46, y: 0.4 },
        radius: 0.78,
        colorSpace: 'oklch',
      },
    },
  ]
}

function sdfFor(shape: VectorShape): Record<string, number | string> {
  if (shape.kind === 'circle' || shape.role === 'lens') {
    return { type: 'circleSDF', radius: shape.rx }
  }
  if (shape.kind === 'ring') {
    return { type: 'ringSDF', radius: shape.rx, thickness: shape.ry }
  }
  return { type: 'ellipseSDF', width: shape.rx, height: shape.ry, rotation: 0 }
}

function plastic(shape: VectorShape, params: Params): ComponentConfig {
  const props: Record<string, unknown> = {
      center: { x: shape.cx, y: shape.cy },
      rotation: shape.rotation,
      scale: 1,
      colorA: shape.colorA,
      colorB: shape.colorB,
      gradientAngle: shape.rotation + 24,
      colorSpace: 'oklch',
      thickness: params.inflation,
      roughness: roughnessOf(params),
      reflectivity: (0.16 + params.highlight * 0.4) * (shape.kind === 'circle' ? 0.55 : 1),
      crumple: 0,
      crumpleScale: 1,
      crumpleCoverage: 0,
      seed: Math.abs(shape.lightOffset),
      edgeSoftness: params.softness,
      lightAngle: params.light + shape.lightOffset,
      speed: 0,
      shading: 0.7,
      rim: 0.16 + params.highlight * 0.4,
      rimColor: mixHex('#fffaf6', shape.colorA, 0.22),
      opacity: shape.opacity,
      shape: sdfFor(shape),
  }
  if (shape.stops) props.stops = shape.stops
  return { id: shape.id, type: 'Plastic', props }
}

function glass(shape: VectorShape, params: Params): ComponentConfig {
  return {
    id: shape.id,
    type: 'Glass',
    props: {
      center: { x: shape.cx, y: shape.cy },
      rotation: shape.rotation,
      scale: 1,
      cutout: true,
      refraction: 0.12 + params.highlight * 0.22,
      aberration: 0.05 + params.highlight * 0.08,
      thickness: clamp(params.inflation * 0.62, 0.12, 0.85),
      blur: (1 - params.gloss) * 1.6,
      highlight: 0.08 + params.highlight * 0.7,
      highlightSoftness: 0.38,
      highlightColor: '#ffffff',
      fresnel: 0.1 + params.highlight * 0.48,
      fresnelSoftness: 0.18,
      fresnelColor: mixHex('#ffffff', shape.colorA, 0.3),
      tintColor: shape.colorA,
      tintIntensity: shape.role === 'lens' ? 0.06 : 0.55,
      tintPreserveLuminosity: shape.role === 'lens',
      edgeSoftness: Math.max(params.softness, 0.004),
      lightAngle: params.light + shape.lightOffset,
      innerZoom: 1,
      opacity: shape.opacity,
      shape: sdfFor(shape),
    },
  }
}

function componentFor(shape: VectorShape, params: Params): ComponentConfig {
  if (shape.surface === 'glass' || shape.role === 'lens') return glass(shape, params)
  return plastic(shape, params)
}

function finish(params: Params, accent: string, vectors: VectorShape[]): Mark {
  return {
    background: params.background,
    accent,
    vectors,
    components: [...backdrop(params, accent), ...vectors.map((shape) => componentFor(shape, params))],
  }
}

function bloom(params: Params): Mark {
  const count = clamp(Math.round(params.count), 6, 12)
  const vectors: VectorShape[] = []
  const back: number[] = []
  const front: number[] = []
  for (let index = 0; index < count; index += 1) {
    if (index % 2 === 0) back.push(index)
    else front.push(index)
  }

  for (const index of [...back, ...front]) {
    const even = index % 2 === 0
    const angle = params.rotation - 90 + (index / count) * 360
    const orbit = params.spacing * (even ? 1 : 0.92)
    const at = place(angle, orbit)
    const colors = petalColors(params.colors, index)
    const length = even ? 1 : 0.86
    vectors.push({
      id: `petal-${index}`,
      kind: 'ellipse',
      cx: at.x,
      cy: at.y,
      rx: params.scale * 0.084,
      ry: params.scale * 0.235 * length,
      rotation: angle + 90,
      colorA: colors.colorA,
      colorB: colors.colorB,
      opacity: opacityOf(params),
      lightOffset: index * 17,
      role: 'body',
      surface: 'plastic',
    })
  }

  const core = petalColors(params.colors, 2)
  vectors.push({
    id: 'core',
    kind: 'circle',
    cx: 0.5,
    cy: 0.5,
    rx: params.scale * 0.055,
    ry: params.scale * 0.055,
    rotation: params.rotation,
    colorA: mixHex(core.colorA, '#fff4ea', 0.2),
    colorB: core.colorB,
    opacity: 1,
    lightOffset: 8,
    role: 'body',
    surface: 'plastic',
  })

  return finish(params, params.colors[0] ?? '#ff8aa8', vectors)
}

function coin(params: Params): Mark {
  const [pearl, blush, violet, ice, honey] = params.colors
  const lobe = rotatePoint(params.spacing * 1.65, params.spacing * 0.2, params.rotation)
  const bodyRadius = 0.28 * params.scale
  const vectors: VectorShape[] = [
    {
      id: 'lobe',
      kind: 'ellipse',
      cx: 0.5 + lobe.x,
      cy: 0.5 + lobe.y,
      rx: 0.17 * params.scale,
      ry: 0.21 * params.scale,
      rotation: params.rotation - 24,
      colorA: honey ?? '#ffe3a4',
      colorB: blush ?? '#ffc9b8',
      opacity: clamp(opacityOf(params) * 0.96, 0.4, 1),
      lightOffset: 20,
      role: 'body',
      surface: 'plastic',
    },
    {
      id: 'body',
      kind: 'circle',
      cx: 0.5,
      cy: 0.5,
      rx: bodyRadius,
      ry: bodyRadius,
      rotation: params.rotation,
      colorA: pearl ?? '#fff7ee',
      colorB: violet ?? '#d9c4ff',
      stops: [
        { color: pearl ?? '#fff7ee', position: 0 },
        { color: blush ?? '#ffc9b8', position: 0.28 },
        { color: honey ?? '#ffe3a4', position: 0.48 },
        { color: ice ?? '#9fd4ff', position: 0.72 },
        { color: violet ?? '#d9c4ff', position: 1 },
      ],
      opacity: 1,
      lightOffset: 0,
      role: 'body',
      surface: 'plastic',
    },
    {
      id: 'lens',
      kind: 'circle',
      cx: 0.5,
      cy: 0.5,
      rx: bodyRadius * 0.98,
      ry: bodyRadius * 0.98,
      rotation: 0,
      colorA: '#ffffff',
      colorB: ice ?? '#9fd4ff',
      opacity: 1,
      lightOffset: 0,
      role: 'lens',
      surface: 'glass',
    },
  ]
  return finish(params, blush ?? '#ffc9b8', vectors)
}

function orbit(params: Params): Mark {
  const count = clamp(Math.round(params.count), 2, 5)
  const vectors: VectorShape[] = []
  for (let index = 0; index < count; index += 1) {
    const colors = petalColors(params.colors, index)
    const angle = params.rotation + index * (180 / count) + index * 6
    vectors.push({
      id: `ring-${index}`,
      kind: 'ellipse',
      cx: 0.5,
      cy: 0.5,
      rx: params.scale * (0.34 + index * 0.012),
      ry: params.scale * params.spacing,
      rotation: angle,
      colorA: colors.colorA,
      colorB: colors.colorB,
      opacity: opacityOf(params),
      lightOffset: index * 28,
      role: 'body',
      surface: 'plastic',
    })
  }
  const coreColor = params.colors[0] ?? '#7ee7dc'
  vectors.push({
    id: 'core',
    kind: 'circle',
    cx: 0.5,
    cy: 0.5,
    rx: params.scale * 0.055,
    ry: params.scale * 0.055,
    rotation: 0,
    colorA: coreColor,
    colorB: shade(coreColor, -0.35),
    opacity: 1,
    lightOffset: 0,
    role: 'body',
    surface: 'plastic',
  })
  return finish(params, params.colors[0] ?? '#7ee7dc', vectors)
}

const fluidLayout = [
  { ox: 0.0, oy: -0.05, rot: -18, rx: 0.18, ry: 0.27 },
  { ox: 0.1, oy: 0.07, rot: 38, rx: 0.2, ry: 0.16 },
  { ox: -0.12, oy: 0.06, rot: -52, rx: 0.15, ry: 0.23 },
  { ox: 0.015, oy: 0.01, rot: 78, rx: 0.09, ry: 0.25 },
  { ox: 0.14, oy: -0.1, rot: 18, rx: 0.075, ry: 0.2 },
  { ox: -0.15, oy: -0.05, rot: 64, rx: 0.085, ry: 0.19 },
  { ox: 0.0, oy: 0.16, rot: -24, rx: 0.17, ry: 0.1 },
]

function fluid(params: Params): Mark {
  const count = clamp(Math.round(params.count), 5, 7)
  const spread = params.spacing / 0.16
  const vectors: VectorShape[] = []
  for (let index = 0; index < count; index += 1) {
    const item = fluidLayout[index]
    const turned = rotatePoint(item.ox * spread, item.oy * spread, params.rotation)
    const colors = petalColors(params.colors, index)
    vectors.push({
      id: `mass-${index}`,
      kind: 'ellipse',
      cx: 0.5 + turned.x,
      cy: 0.5 + turned.y,
      rx: item.rx * params.scale,
      ry: item.ry * params.scale,
      rotation: item.rot + params.rotation,
      colorA: colors.colorA,
      colorB: colors.colorB,
      opacity: opacityOf(params),
      lightOffset: index * 23,
      role: 'body',
      surface: 'plastic',
    })
  }
  return finish(params, params.colors[2] ?? '#7a5cff', vectors)
}

function growth(params: Params): Mark {
  const count = clamp(Math.round(params.count), 4, 8)
  const placed: VectorShape[] = []
  for (let index = 0; index < count; index += 1) {
    const t = count === 1 ? 1 : index / (count - 1)
    const angle = params.rotation + t * 280 - 20
    const orbit = (params.spacing / 0.15) * (0.05 + t * 0.24)
    const at = place(angle, orbit)
    const radius = params.scale * (0.055 + t * 0.095)
    const colorA = samplePalette(params.colors, t)
    const colorB = shade(samplePalette(params.colors, Math.min(1, t + 0.16)), -0.18)
    placed.push({
      id: `step-${index}`,
      kind: 'ellipse',
      cx: at.x,
      cy: at.y,
      rx: radius,
      ry: radius * 0.78,
      rotation: angle + 90,
      colorA,
      colorB,
      opacity: opacityOf(params),
      lightOffset: index * 14,
      role: 'body',
      surface: 'plastic',
    })
  }
  let weight = 0
  let shiftX = 0
  let shiftY = 0
  for (const shape of placed) {
    weight += shape.rx
    shiftX += shape.cx * shape.rx
    shiftY += shape.cy * shape.rx
  }
  const centerX = shiftX / weight
  const centerY = shiftY / weight
  for (const shape of placed) {
    shape.cx += 0.5 - centerX
    shape.cy += 0.5 - centerY
  }
  return finish(params, params.colors[3] ?? '#f2c94c', placed)
}

function aperture(params: Params): Mark {
  const count = clamp(Math.round(params.count), 5, 9)
  const vectors: VectorShape[] = []
  for (let index = 0; index < count; index += 1) {
    const angle = params.rotation - 90 + (index / count) * 360
    const wobble = index % 2 === 0 ? 1 : 0.94
    const at = place(angle, params.spacing * wobble)
    const colors = petalColors(params.colors, index)
    vectors.push({
      id: `segment-${index}`,
      kind: 'ellipse',
      cx: at.x,
      cy: at.y,
      rx: params.scale * 0.135,
      ry: params.scale * 0.058,
      rotation: angle + 90,
      colorA: colors.colorA,
      colorB: colors.colorB,
      opacity: opacityOf(params),
      lightOffset: index * 21,
      role: 'body',
      surface: 'plastic',
    })
  }
  const core = params.colors[params.colors.length - 1] ?? '#fff0cc'
  vectors.push({
    id: 'core',
    kind: 'circle',
    cx: 0.5,
    cy: 0.5,
    rx: params.scale * 0.048,
    ry: params.scale * 0.048,
    rotation: 0,
    colorA: core,
    colorB: shade(params.colors[1] ?? core, -0.2),
    opacity: 1,
    lightOffset: 0,
    role: 'body',
    surface: 'plastic',
  })
  return finish(params, params.colors[1] ?? '#8ef0e0', vectors)
}

const shared = {
  gloss: 0.86,
  highlight: 0.68,
  transparency: 0.05,
  softness: 0.01,
  inflation: 0.82,
  light: 318,
}

export const concepts: Concept[] = [
  {
    id: 'bloom',
    letter: 'A',
    name: 'Glass Bloom',
    filename: '01-glass-bloom',
    summary: 'Radial petals, each with its own gradient and highlight. The core is a small bead, not a second flower.',
    defaults: {
      ...shared,
      background: '#1a1222',
      colors: ['#ff5f8a', '#ff7a48', '#b388ff', '#3ad4b8', '#6aa4ff'],
      count: 10,
      spacing: 0.168,
      scale: 1.02,
      rotation: -12,
      inflation: 0.86,
    },
    sliders: form(
      { key: 'count', label: 'Petals', min: 6, max: 12, step: 1 },
      { key: 'spacing', label: 'Spread', min: 0.08, max: 0.22, step: 0.002 },
      { key: 'scale', label: 'Scale', min: 0.7, max: 1.25, step: 0.01 },
      { key: 'rotation', label: 'Rotation', min: -180, max: 180, step: 1 },
    ),
    compose: bloom,
  },
  {
    id: 'coin',
    letter: 'B',
    name: 'Liquid Coin',
    filename: '02-liquid-coin',
    summary: 'A fluid disc with a side lobe and a refractive lens. The bulge keeps it from reading as currency.',
    defaults: {
      ...shared,
      background: '#f3eee6',
      colors: ['#ffe4d6', '#ff7f92', '#8d74ff', '#5eb8ff', '#ffc56a'],
      count: 1,
      spacing: 0.16,
      scale: 1.06,
      rotation: -18,
      gloss: 0.8,
      highlight: 0.76,
      transparency: 0.02,
      softness: 0.006,
      inflation: 0.92,
      light: 300,
    },
    sliders: form(
      null,
      { key: 'spacing', label: 'Lobe offset', min: 0.04, max: 0.18, step: 0.002 },
      { key: 'scale', label: 'Scale', min: 0.75, max: 1.3, step: 0.01 },
      { key: 'rotation', label: 'Rotation', min: -180, max: 180, step: 1 },
    ),
    compose: coin,
  },
  {
    id: 'orbit',
    letter: 'C',
    name: 'Orbit',
    filename: '03-orbit',
    summary: 'Elongated rings crossing a shared center. Transparency is what makes the crossings read as depth.',
    defaults: {
      ...shared,
      background: '#101820',
      colors: ['#5ee0d4', '#f0b15a', '#a78bfa', '#f6efe4'],
      count: 3,
      spacing: 0.078,
      scale: 1.08,
      rotation: 18,
      gloss: 0.84,
      highlight: 0.64,
      transparency: 0.2,
      inflation: 0.7,
      light: 306,
    },
    sliders: form(
      { key: 'count', label: 'Rings', min: 2, max: 5, step: 1 },
      { key: 'spacing', label: 'Thickness', min: 0.045, max: 0.16, step: 0.002 },
      { key: 'scale', label: 'Scale', min: 0.75, max: 1.25, step: 0.01 },
      { key: 'rotation', label: 'Rotation', min: -180, max: 180, step: 1 },
    ),
    compose: orbit,
  },
  {
    id: 'fluid',
    letter: 'D',
    name: 'Fluid Petals',
    filename: '04-fluid-petals',
    summary: 'An asymmetric cluster of larger inflated forms. Less flower, more sculpture.',
    defaults: {
      ...shared,
      background: '#1c1418',
      colors: ['#ff5d7e', '#ff9a3c', '#6d4dff', '#2ec9b6', '#c084fc', '#ffbe8a'],
      count: 6,
      spacing: 0.15,
      scale: 1.12,
      rotation: -8,
      gloss: 0.88,
      highlight: 0.7,
      transparency: 0.08,
      inflation: 0.9,
      light: 328,
    },
    sliders: form(
      { key: 'count', label: 'Shapes', min: 5, max: 7, step: 1 },
      { key: 'spacing', label: 'Spread', min: 0.1, max: 0.22, step: 0.002 },
      { key: 'scale', label: 'Scale', min: 0.7, max: 1.2, step: 0.01 },
      { key: 'rotation', label: 'Rotation', min: -180, max: 180, step: 1 },
    ),
    compose: fluid,
  },
  {
    id: 'growth',
    letter: 'E',
    name: 'Growth',
    filename: '05-growth',
    summary: 'Rounded forms swell along a spiral. Color shifts from shape to shape instead of along a chart axis.',
    defaults: {
      ...shared,
      background: '#f6f1e7',
      colors: ['#0e4f4a', '#1a9a72', '#7dce6a', '#f2c94c', '#f08a4a', '#e85d78'],
      count: 6,
      spacing: 0.15,
      scale: 1.05,
      rotation: -30,
      gloss: 0.8,
      highlight: 0.58,
      transparency: 0,
      inflation: 0.78,
      light: 332,
    },
    sliders: form(
      { key: 'count', label: 'Steps', min: 4, max: 8, step: 1 },
      { key: 'spacing', label: 'Spread', min: 0.1, max: 0.2, step: 0.002 },
      { key: 'scale', label: 'Scale', min: 0.75, max: 1.3, step: 0.01 },
      { key: 'rotation', label: 'Rotation', min: -180, max: 180, step: 1 },
    ),
    compose: growth,
  },
  {
    id: 'aperture',
    letter: 'F',
    name: 'Aperture',
    filename: '06-aperture',
    summary: 'Short bars follow a ring instead of pointing outward. The silhouette is an iris, not a flower.',
    defaults: {
      ...shared,
      background: '#12141a',
      colors: ['#8eb6ff', '#2ec4b6', '#ff6d92', '#ffd15c'],
      count: 7,
      spacing: 0.25,
      scale: 1.08,
      rotation: -12,
      gloss: 0.9,
      highlight: 0.72,
      transparency: 0.04,
      inflation: 0.74,
      light: 312,
    },
    sliders: form(
      { key: 'count', label: 'Segments', min: 5, max: 9, step: 1 },
      { key: 'spacing', label: 'Radius', min: 0.12, max: 0.26, step: 0.002 },
      { key: 'scale', label: 'Scale', min: 0.7, max: 1.25, step: 0.01 },
      { key: 'rotation', label: 'Rotation', min: -180, max: 180, step: 1 },
    ),
    compose: aperture,
  },
]

export function conceptById(id: string): Concept {
  const found = concepts.find((concept) => concept.id === id)
  if (!found) return concepts[0]
  return found
}

export function cloneParams(params: Params): Params {
  return { ...params, colors: [...params.colors] }
}

export function geometryKey(concept: Concept, params: Params): string {
  return [
    concept.id,
    Math.round(params.count),
    params.spacing.toFixed(4),
    params.scale.toFixed(4),
    params.rotation.toFixed(2),
  ].join('|')
}
