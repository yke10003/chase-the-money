import type { ComponentConfig } from 'shaders/js'
import { sampleRamp, sampleRampWrapped, type Palette, type Stop } from './palettes'

export const background = '#0b1d3a'

/** One elongated inflated lobe, tipped so the top surface faces the light. */
export const petal = {
  type: 'ellipsoid3D',
  radiusX: 0.17,
  radiusY: 0.38,
  radiusZ: 0.15,
  rotX: 52,
  rotY: 28,
  rotZ: -12,
}

export type MaterialKnobs = {
  lightAngle: number
  gradientAngle: number
  roughness: number
  reflectivity: number
  thickness: number
  shading: number
  rim: number
  /** 0 is a straight ramp. 1 is a broad sine bow across the color field. */
  curvature: number
  /** How many bows fit across the field. 1 is one gentle arc. */
  waveScale: number
  /** 0 keeps the ramp still. 1 lets the drift travel a clearly visible distance. */
  motion: number
  /** How fast the ramp travels when motion is above 0. */
  driftSpeed: number
  /** Extra strength for the selected effect. Plastic looks ignore it. */
  effect: number
}

export const materialDefaults: MaterialKnobs = {
  lightAngle: 310,
  gradientAngle: 78,
  roughness: 0.5,
  reflectivity: 0.28,
  thickness: 1,
  shading: 0.86,
  rim: 0.16,
  curvature: 0.32,
  waveScale: 1,
  motion: 0,
  driftSpeed: 0.35,
  effect: 0.65,
}

export type BloomKnobs = {
  count: number
  overlap: number
  radial: number
  arrangement: number
  fieldRotation: number
  /** 0 is a top-down circle. 1 foreshortens the ring into a shallow ellipse. */
  tilt: number
  /** How tightly the repeating sheet is packed across the bloom. */
  gradientOffset: number
  /** Mirrored folds the palette back on itself. Straight restarts it. */
  repeat: RepeatMode
}

export type RepeatMode = 'mirror' | 'straight'

export type Surface =
  | 'plastic'
  | 'soft'
  | 'gloss'
  | 'pearl'
  | 'heatmap'
  | 'chrome'
  | 'holo'
  | 'glass'
  | 'film'
  | 'crystal'
  | 'liquid'
  | 'emboss'
  | 'irradiance'
  | 'goo'

export const surfaces: { id: Surface; label: string; note: string; onBloom: boolean }[] = [
  { id: 'plastic', label: 'Plastic', note: 'Full ramp on the inflated form.', onBloom: true },
  { id: 'soft', label: 'Soft', note: 'Same ramp, duller and more diffuse.', onBloom: true },
  { id: 'gloss', label: 'Gloss', note: 'Same ramp, sharper reflections.', onBloom: true },
  { id: 'pearl', label: 'Pearl', note: 'Same ramp, with a stronger colored rim.', onBloom: true },
  { id: 'heatmap', label: 'Heatmap', note: 'The palette is the heat ramp on the lobe.', onBloom: true },
  { id: 'chrome', label: 'Chrome', note: 'Studio metal. Tint comes from the palette. Not a full ramp.', onBloom: true },
  { id: 'holo', label: 'Holographic', note: 'Spectral foil. The palette does not drive the rainbow.', onBloom: true },
  { id: 'glass', label: 'Glass', note: 'Works on one lobe, refracting the ramp behind it. Fourteen copies draw blank.', onBloom: false },
  { id: 'film', label: 'Thin film', note: 'Iridescent rim over one plastic lobe. Fourteen copies draw blank.', onBloom: false },
  { id: 'crystal', label: 'Crystal', note: 'Kept for one lobe. Fourteen copies draw blank.', onBloom: false },
  { id: 'liquid', label: 'Liquid metal', note: 'Molten highlight on one lobe. Not checked on the full ring.', onBloom: false },
  { id: 'emboss', label: 'Emboss', note: 'Flat relief, not the inflated lobe. Little palette color.', onBloom: false },
  { id: 'irradiance', label: 'Irradiance', note: 'A few colored lights on a dark lobe. Limited.', onBloom: false },
  { id: 'goo', label: 'Goo', note: 'One tint per lobe. Weak fit for this direction.', onBloom: true },
]

export function surfaceNote(surface: Surface) {
  return surfaces.find((item) => item.id === surface)?.note ?? ''
}

export const bloomDefaults: BloomKnobs = {
  count: 14,
  overlap: 0.82,
  radial: 0.22,
  arrangement: -6,
  gradientOffset: 0.42,
  fieldRotation: 0,
  tilt: 0.5,
  repeat: 'mirror',
}

function plasticProps(
  knobs: MaterialKnobs,
  stops: Stop[],
  gradientAngle: number,
  center: { x: number; y: number },
  shape: Record<string, unknown>,
  scale = 1,
) {
  return {
    center,
    scale,
    rotation: 0,
    colorA: stops[stops.length - 1].color,
    colorB: stops[0].color,
    stops,
    gradientAngle,
    colorSpace: 'oklch',
    thickness: knobs.thickness,
    roughness: knobs.roughness,
    reflectivity: knobs.reflectivity,
    crumple: 0,
    crumpleScale: 1,
    crumpleCoverage: 0,
    seed: 1,
    edgeSoftness: 0.012,
    lightAngle: knobs.lightAngle,
    speed: 0,
    shading: knobs.shading,
    rim: knobs.rim,
    rimColor: '#fff6ee',
    shape,
  }
}

/** How wide the mirror's turnaround is, in palette cycles. The middle of the fold stays linear. */
const fold = 0.14

/**
 * Mirror used to reverse with a sharp corner, so the band sitting on that
 * corner changed direction in one frame. Round the corner. Away from it,
 * the position matches the old fold, so the wave stays put.
 */
function mirroredUnit(cycle: number) {
  const x = ((cycle % 2) + 2) % 2
  if (x < fold) return roundedValley(x)
  if (x > 2 - fold) return roundedValley(x - 2)
  if (Math.abs(x - 1) < fold) return roundedPeak(x)
  return x <= 1 ? x : 2 - x
}

function roundedValley(x: number) {
  const u = (x + fold) / (2 * fold)
  return fold - 2 * fold * u * (1 - u)
}

function roundedPeak(x: number) {
  const u = (x - (1 - fold)) / (2 * fold)
  return (1 - fold) + 2 * fold * u * (1 - u)
}

/** Straight mode restarts the palette. Blend across that seam instead of popping. */
function sampleStraight(stops: Stop[], cycle: number) {
  const base = Math.floor(cycle)
  const frac = cycle - base
  const reach = 0.1
  if (frac <= 1 - reach) return sampleRampWrapped(stops, cycle)
  const t = (frac - (1 - reach)) / reach
  const eased = t * t * (3 - 2 * t)
  const end = sampleRampWrapped(stops, base + 1 - reach)
  const start = sampleRamp(stops, 0)
  return mixHex(end, start, eased)
}

function samplePoint(stops: Stop[], cycle: number, repeat: RepeatMode) {
  if (repeat === 'straight') return sampleStraight(stops, cycle)
  return sampleRamp(stops, mirroredUnit(cycle))
}

function channel(hex: string, index: number) {
  return Number.parseInt(hex.slice(1 + index * 2, 3 + index * 2), 16)
}

function mixHex(a: string, b: string, amount: number) {
  const mix = Math.min(1, Math.max(0, amount))
  const value = [0, 1, 2].map((index) => Math.round(channel(a, index) + (channel(b, index) - channel(a, index)) * mix))
  return `#${value.map((part) => part.toString(16).padStart(2, '0')).join('')}`
}

/**
 * One sample on a flat palette stretch does not move, then races when it
 * hits the next color. Average a short neighborhood so that band eases
 * into the change. The inner end of a petal is one sample, so this is
 * where the click was showing.
 */
function sampleField(stops: Stop[], cycle: number, repeat: RepeatMode) {
  const reach = 0.08
  const behind = samplePoint(stops, cycle - reach, repeat)
  const at = samplePoint(stops, cycle, repeat)
  const ahead = samplePoint(stops, cycle + reach, repeat)
  const mid = mixHex(behind, ahead, 0.5)
  return mixHex(mid, at, 0.55)
}

function wavelength(scale: number) {
  return 0.5 - scale * 0.28
}

/** Sample one sliding sheet between two field positions, then ease the stops. */
function sheetStops(
  palette: Palette,
  knobs: MaterialKnobs,
  fromCycle: number,
  toCycle: number,
  repeat: RepeatMode,
) {
  const last = palette.stops.length - 1
  const sampled = palette.stops.map((_, index) => {
    const u = index / last
    return {
      position: u,
      color: sampleField(palette.stops, fromCycle + (toCycle - fromCycle) * u, repeat),
    }
  })
  return bendStops(sampled, knobs.curvature, knobs.waveScale)
}

/** Bunch the ramp so color changes faster across the crown and lingers on the body. */
function bendStops(stops: Stop[], curvature: number, waveScale: number): Stop[] {
  if (curvature <= 0.001) return stops
  const bent = stops.map((stop) => {
    const along = stop.position
    const bow = Math.sin(along * Math.PI * waveScale) * curvature * 0.16
    const position = Math.min(0.985, Math.max(0.015, along + bow))
    return { color: stop.color, position }
  })
  bent.sort((a, b) => a.position - b.position)
  bent[0] = { ...bent[0], position: 0 }
  bent[bent.length - 1] = { ...bent[bent.length - 1], position: 1 }
  return bent
}

function gradientField(stops: Stop[], angle: number, slide: number, repeat: RepeatMode): ComponentConfig {
  const radians = (angle * Math.PI) / 180
  const dx = Math.cos(radians)
  const dy = Math.sin(radians)
  const reach = 0.55
  return {
    id: 'backdrop',
    type: 'LinearGradient',
    props: {
      colorA: stops[0].color,
      colorB: stops[stops.length - 1].color,
      stops,
      angle: 0,
      start: { x: 0.5 - dx * reach + dx * slide, y: 0.5 - dy * reach + dy * slide },
      end: { x: 0.5 + dx * reach + dx * slide, y: 0.5 + dy * reach + dy * slide },
      colorSpace: 'oklch',
      edges: repeat === 'mirror' ? 'mirror' : 'wrap',
    },
  }
}

function shapeLayers(
  surface: Surface,
  id: string,
  knobs: MaterialKnobs,
  stops: Stop[],
  gradientAngle: number,
  center: { x: number; y: number },
  shape: Record<string, unknown>,
  scale: number,
  rotation = 0,
): ComponentConfig[] {
  const mid = stops[Math.floor(stops.length / 2)].color
  const placed = { center, scale, rotation, shape }
  if (surface === 'heatmap') {
    return [{
      id,
      type: 'Heatmap',
      props: {
        ...placed,
        colorA: stops[0].color,
        colorB: stops[stops.length - 1].color,
        stops,
        colorSpace: 'oklch',
        innerGlow: 0.25 + knobs.shading * 0.45,
        outerGlow: 0.04,
        contour: 0.15 + knobs.effect * 0.7,
        angle: gradientAngle,
        speed: 0,
      },
    }]
  }
  if (surface === 'chrome') {
    return [{
      id,
      type: 'Chrome',
      props: {
        ...placed,
        tint: mid,
        warmColor: stops[stops.length - 1].color,
        coolColor: stops[0].color,
        bevelWidth: 0.045,
        bevelShape: 0.45,
        curvature: 0.55 + knobs.curvature * 0.3,
        waviness: knobs.curvature * 0.35,
        environment: 0.6 + knobs.effect * 1.4,
        envRotation: knobs.lightAngle,
        softness: knobs.roughness,
        spectral: knobs.effect,
        dispersion: knobs.rim,
        shadows: 0.65,
        speed: 0,
      },
    }]
  }
  if (surface === 'holo') {
    return [{
      id,
      type: 'Holographic',
      props: {
        ...placed,
        hueShift: gradientAngle,
        foilScale: 0.7 + knobs.waveScale * 0.35,
        saturation: knobs.effect,
        roughness: knobs.roughness,
        speed: 0,
        crinkle: knobs.curvature * 0.7,
      },
    }]
  }
  if (surface === 'glass') {
    return [{
      id,
      type: 'Glass',
      props: {
        ...placed,
        refraction: 0.2 + knobs.effect * 0.75,
        edgeSoftness: 0.04,
        blur: knobs.roughness * 5,
        thickness: knobs.thickness,
        aberration: 0.3 + knobs.rim * 0.4,
        cutout: true,
        highlight: 0.08 + knobs.reflectivity * 0.3,
        highlightColor: '#fff6ee',
        tintColor: mid,
        tintIntensity: 0.2,
        tintPreserveLuminosity: false,
        lightAngle: knobs.lightAngle,
        fresnel: 0.12 + knobs.rim,
        fresnelColor: '#ffffff',
      },
    }]
  }
  if (surface === 'crystal') {
    return [{
      id,
      type: 'Crystal',
      props: {
        ...placed,
        dispersion: 0.2 + knobs.effect * 0.8,
        facets: 6,
        edgeSoftness: 0.02,
        innerZoom: 1.15,
        cutout: true,
        lightAngle: knobs.lightAngle,
        fresnel: knobs.rim,
        fresnelColor: '#ffffff',
        tintColor: mid,
        tintIntensity: 0.28,
        tintPreserveLuminosity: false,
      },
    }]
  }
  if (surface === 'liquid') {
    return [{
      id,
      type: 'LiquidMetal',
      props: {
        ...placed,
        darkColor: stops[0].color,
        turbulence: 0.4 + knobs.curvature * 0.8,
        ripple: 1.2 + knobs.waveScale,
        warp: knobs.effect,
        sharpness: 1 - knobs.roughness * 0.7,
      },
    }]
  }
  if (surface === 'emboss') {
    return [{
      id,
      type: 'Emboss',
      props: {
        ...placed,
        depth: 0.35 + knobs.effect * 0.5,
        lightAngle: knobs.lightAngle,
        lightIntensity: 0.4 + knobs.reflectivity,
        shadowIntensity: knobs.shading * 0.6,
      },
    }]
  }
  if (surface === 'irradiance') {
    return [{
      id,
      type: 'Irradiance',
      props: {
        ...placed,
        lights: [
          { position: { x: 0.25, y: 0.3 }, color: stops[0].color, intensity: 1.1 },
          { position: { x: 0.72, y: 0.38 }, color: mid, intensity: 0.9 },
          { position: { x: 0.5, y: 0.78 }, color: stops[stops.length - 1].color, intensity: 1 },
        ],
        wrap: 0.2 + knobs.effect * 0.4,
        shadows: true,
        shadowSoftness: 0.2,
        bodyColor: '#1a1a1a',
        bodyLight: 0.35 + knobs.shading * 0.5,
        bevelWidth: 0.04,
        edgeSoftness: 0.02,
      },
    }]
  }
  if (surface === 'goo') {
    return [{
      id,
      type: 'Goo',
      props: {
        center,
        scale,
        rotation,
        gooColor: mid,
        translucency: 0.4,
        absorb: 1.6,
        containment: 1,
        edgeSoftness: 0.02,
        blobScale: 0.9,
        spread: 0.05,
        merge: 0.92,
        bulge: knobs.thickness,
        threshold: 0.58,
        lightAngle: knobs.lightAngle,
        wetness: 0.4 + knobs.reflectivity * 1.6,
        fresnel: knobs.rim,
        specColor: '#fff6ee',
        ambient: 0.15 + knobs.shading * 0.35,
        speed: 0,
        wobble: 0,
        breathe: 0,
        seed: 1,
        shape,
      },
    }]
  }
  const props = plasticProps(knobs, stops, gradientAngle, center, shape, scale)
  props.rotation = rotation
  if (surface === 'soft') {
    props.roughness = Math.min(0.92, knobs.roughness * 0.35 + 0.55)
    props.reflectivity = knobs.reflectivity * 0.35
    props.shading = knobs.shading * 0.72
    props.rim = knobs.rim * 0.4
    props.edgeSoftness = 0.04
  } else if (surface === 'gloss') {
    props.roughness = Math.max(0.04, knobs.roughness * 0.25)
    props.reflectivity = Math.min(1.6, knobs.reflectivity + 0.75)
    props.rim = Math.min(1, knobs.rim + 0.3)
    props.edgeSoftness = 0.008
  } else if (surface === 'pearl') {
    props.roughness = 0.16 + knobs.roughness * 0.12
    props.reflectivity = Math.min(1.5, 0.8 + knobs.reflectivity * 0.35)
    props.rim = Math.min(1, 0.5 + knobs.rim * 0.45)
    props.shading = knobs.shading * 0.88
    props.rimColor = '#ffe7f3'
    props.edgeSoftness = 0.018
  }
  const plastic = { id, type: 'Plastic', props }
  if (surface !== 'film') return [plastic]
  return [
    plastic,
    {
      id: `film-${id}`,
      type: 'ThinFilm',
      props: {
        center,
        scale,
        rotation,
        intensity: 0.6 + knobs.rim,
        rimWidth: 0.7,
        edgeSoftness: 0.05,
        thickness: 0.25 + knobs.effect * 0.6,
        dispersion: 0.35 + knobs.effect * 0.5,
        saturation: 1,
        hueShift: gradientAngle,
        lightAngle: knobs.lightAngle,
        speed: 0,
        mode: 'custom',
        colorA: stops[0].color,
        colorB: mid,
        colorC: stops[stops.length - 1].color,
        colorSpace: 'oklch',
        shape,
        maskSource: id,
        maskType: 'alpha',
        blendMode: 'screen',
      },
    },
  ]
}

/** Soft halo from the brighter pixels. Kept faint so the lobes stay readable. */
function withHalo(layers: ComponentConfig[]): ComponentConfig[] {
  return [{
    id: 'halo',
    type: 'Glow',
    props: {
      intensity: 0.75,
      threshold: 0.28,
      size: 56,
    },
    children: layers,
  }]
}

/** One petal. Color lives on the plastic gradient, in the shape's own coordinates. */
function usesBackdrop(surface: Surface) {
  return surface === 'glass' || surface === 'crystal'
}

export function masterScene(
  knobs: MaterialKnobs,
  palette: Palette,
  drift = 0,
  surface: Surface = 'plastic',
  repeat: RepeatMode = 'mirror',
): ComponentConfig[] {
  const angle = knobs.gradientAngle
  const span = 0.2
  const wave = 0.42
  const stops = sheetStops(palette, knobs, (-span + drift) / wave, (span + drift) / wave, repeat)
  const components: ComponentConfig[] = [
    { id: 'ground', type: 'SolidColor', props: { color: background } },
  ]
  if (usesBackdrop(surface)) components.push(gradientField(palette.stops, angle, drift, repeat))
  components.push(...shapeLayers(surface, 'body', knobs, stops, angle, { x: 0.5, y: 0.52 }, petal, 1.55))
  return withHalo(components)
}

type Placement = {
  id: string
  index: number
  turn: number
  x: number
  y: number
  depth: number
  length: number
  width: number
  thick: number
  rotX: number
  rotY: number
  rotZ: number
  /** Tangent of the ring, in degrees. The tumble spins around this. */
  axis: number
  scale: number
}

/**
 * Petal centers sit on a circle, then the circle is squashed into an ellipse.
 * Screen-down is the near side, so those lobes draw last and cover the far ones.
 * Each lobe is shorter than the ring radius, which leaves the middle open.
 */
function placements(bloom: BloomKnobs): Placement[] {
  const count = Math.round(bloom.count)
  const squeeze = 1 - bloom.tilt * 0.48
  const ring = bloom.radial
  const chord = 2 * ring * Math.sin(Math.PI / count)
  const length = ring * (0.62 + bloom.overlap * 0.12)
  const packed = (chord / 2) * (1.2 + bloom.overlap * 0.55)
  const width = Math.min(packed, length * 0.72)
  const thick = length * 0.4
  const placed: Placement[] = []

  for (let index = 0; index < count; index += 1) {
    const turn = (index / count) * Math.PI * 2 + (bloom.arrangement * Math.PI) / 180
    const dx = Math.cos(turn)
    const dy = Math.sin(turn) * squeeze
    const near = (Math.sin(turn) + 1) / 2
    const x = 0.5 + dx * ring
    const y = 0.48 + dy * ring
    placed.push({
      id: String(index),
      index,
      turn,
      x,
      y,
      depth: y,
      length,
      width,
      thick,
      rotX: 20,
      rotY: 0,
      rotZ: 0,
      axis: (Math.atan2(dy, dx) * 180) / Math.PI + 90,
      scale: 0.94 + near * 0.12,
    })
  }

  placed.sort((a, b) => a.depth - b.depth)
  return placed
}

function onePetal(
  placed: Placement,
  knobs: MaterialKnobs,
  palette: Palette,
  bloom: BloomKnobs,
  drift: number,
  surface: Surface,
  tumble: number,
): ComponentConfig[] {
  const travel = drift / wavelength(bloom.gradientOffset)
  const span = 0.7 + bloom.gradientOffset * 0.6
  const gradientAngle = 90 + bloom.fieldRotation + (knobs.gradientAngle - 78)
  const shape = {
    type: 'ellipsoid3D',
    radiusX: placed.width,
    radiusY: placed.length,
    radiusZ: placed.thick,
    rotX: tumble,
    rotY: 0,
    rotZ: 0,
  }
  return shapeLayers(
    surface,
    `body-${placed.id}`,
    knobs,
    sheetStops(palette, knobs, travel, travel + span, bloom.repeat),
    gradientAngle,
    { x: placed.x, y: placed.y },
    shape,
    placed.scale,
    placed.axis,
  )
}

export function petalFileName(order: number, count: number) {
  const label = String(order).padStart(2, '0')
  if (order === 1) return `${label}_petal_back.png`
  if (order === count) return `${label}_petal_front.png`
  return `${label}_petal.png`
}

/** Back to front. Depth is the screen position used to stack the ring. */
export function bloomLayerOrder(bloom: BloomKnobs) {
  const placed = placements(bloom)
  return placed.map((item, index) => ({
    id: item.id,
    depth: item.depth,
    order: index + 1,
    fileName: petalFileName(index + 1, placed.length),
  }))
}

/** One petal, same pose and ramp as the ring, on a flat ground, without the shared glow. */
export function isolatedPetalScene(
  knobs: MaterialKnobs,
  palette: Palette,
  bloom: BloomKnobs,
  drift: number,
  surface: Surface,
  tumble: number,
  petalId: string,
  groundColor: string,
): ComponentConfig[] {
  const placed = placements(bloom).find((item) => item.id === petalId)
  if (!placed) throw new Error(`No petal ${petalId}`)
  return [
    { id: 'ground', type: 'SolidColor', props: { color: groundColor } },
    ...onePetal(placed, knobs, palette, bloom, drift, surface, tumble),
  ]
}

/**
 * Each petal carries the full palette on its own axis. Motion slides that
 * ramp along the petal. It is not one sheet shared across the ring.
 */
export function bloomScene(
  knobs: MaterialKnobs,
  palette: Palette,
  bloom: BloomKnobs,
  drift = 0,
  surface: Surface = 'plastic',
  tumble = 20,
  groundColor = background,
  halo = true,
): ComponentConfig[] {
  const components: ComponentConfig[] = [
    { id: 'ground', type: 'SolidColor', props: { color: groundColor } },
  ]
  if (usesBackdrop(surface)) components.push(gradientField(palette.stops, knobs.gradientAngle, drift, bloom.repeat))

  for (const placed of placements(bloom)) {
    components.push(...onePetal(placed, knobs, palette, bloom, drift, surface, tumble))
  }

  if (!halo) return components
  if (groundColor === background) return withHalo(components)
  const ground = components[0]
  if (!ground) return withHalo(components)
  return [ground, ...withHalo(components.slice(1))]
}

export type MarkId = 'bloom' | 'sell' | 'freelance' | 'recover' | 'build' | 'explore'

export const marks: { id: MarkId; label: string; lede: string }[] = [
  { id: 'bloom', label: 'Home', lede: 'Bloom ring. Each petal has its own ramp, lined up with that lobe.' },
  { id: 'sell', label: 'Sell', lede: 'A soft drop, leaning up and to the right.' },
  { id: 'freelance', label: 'Freelance', lede: 'Two lenses crossing, the same inflated material.' },
  { id: 'recover', label: 'Recover', lede: 'A thick crescent, open like a cradle.' },
  { id: 'build', label: 'Build', lede: 'Three soft blocks, stacked and narrower toward the top.' },
  { id: 'explore', label: 'Explore', lede: 'A tilted ellipse, the neutral form between the others.' },
]

type Piece = {
  id: string
  shape: Record<string, unknown>
  center: { x: number; y: number }
  scale: number
  rotation: number
}

function pieces(mark: MarkId): Piece[] {
  if (mark === 'sell') {
    return [{
      id: 'drop',
      shape: { type: 'teardropSDF', radius: 0.17, height: 0.42 },
      center: { x: 0.48, y: 0.54 },
      scale: 1.25,
      rotation: 28,
    }]
  }
  if (mark === 'freelance') {
    const lens = { type: 'vesicaSDF', radius: 0.32, spread: 0.46 }
    return [
      { id: 'lens-a', shape: lens, center: { x: 0.46, y: 0.52 }, scale: 1.05, rotation: -18 },
      { id: 'lens-b', shape: { ...lens }, center: { x: 0.55, y: 0.48 }, scale: 1.05, rotation: 16 },
    ]
  }
  if (mark === 'recover') {
    return [{
      id: 'cradle',
      shape: { type: 'crescentSDF', radius: 0.36, innerRatio: 0.62, offset: 0.18 },
      center: { x: 0.5, y: 0.5 },
      scale: 1.2,
      rotation: -20,
    }]
  }
  if (mark === 'build') {
    return [
      { id: 'base', shape: { type: 'roundedRectSDF', radius: 0.26, height: 0.08, rounding: 0.045 }, center: { x: 0.5, y: 0.62 }, scale: 1.2, rotation: 0 },
      { id: 'mid', shape: { type: 'roundedRectSDF', radius: 0.19, height: 0.07, rounding: 0.04 }, center: { x: 0.5, y: 0.48 }, scale: 1.2, rotation: 0 },
      { id: 'cap', shape: { type: 'trapezoidSDF', radius: 0.14, topWidth: 0.08, height: 0.07 }, center: { x: 0.5, y: 0.35 }, scale: 1.2, rotation: 0 },
    ]
  }
  return [{
    id: 'orbit',
    shape: { type: 'ellipseSDF', radius: 0.36, height: 0.16 },
    center: { x: 0.5, y: 0.5 },
    scale: 1.15,
    rotation: -22,
  }]
}

/**
 * Same sheet, material, and halo as the bloom, on a different silhouette.
 * The ring stays in bloomScene.
 */
export function markScene(
  mark: MarkId,
  knobs: MaterialKnobs,
  palette: Palette,
  bloom: BloomKnobs,
  drift = 0,
  surface: Surface = 'plastic',
  tumble = 20,
): ComponentConfig[] {
  if (mark === 'bloom') return bloomScene(knobs, palette, bloom, drift, surface, tumble)
  const travel = drift / wavelength(bloom.gradientOffset)
  const span = 0.7 + bloom.gradientOffset * 0.6
  const stops = sheetStops(palette, knobs, travel, travel + span, bloom.repeat)
  const gradientAngle = 90 + bloom.fieldRotation + (knobs.gradientAngle - 78)
  const sway = (tumble - 20) * 0.12
  const components: ComponentConfig[] = [
    { id: 'ground', type: 'SolidColor', props: { color: background } },
  ]
  if (usesBackdrop(surface)) components.push(gradientField(palette.stops, knobs.gradientAngle, drift, bloom.repeat))
  for (const piece of pieces(mark)) {
    components.push(...shapeLayers(
      surface,
      piece.id,
      knobs,
      stops,
      gradientAngle,
      piece.center,
      piece.shape,
      piece.scale,
      piece.rotation + sway,
    ))
  }
  return withHalo(components)
}
