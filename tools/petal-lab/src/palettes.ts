export type Stop = { color: string; position: number }

function channel(hex: string, index: number): number {
  return Number.parseInt(hex.slice(1 + index * 2, 3 + index * 2), 16)
}

function mixHex(a: string, b: string, amount: number): string {
  const mix = Math.min(1, Math.max(0, amount))
  const value = [0, 1, 2].map((index) => Math.round(channel(a, index) + (channel(b, index) - channel(a, index)) * mix))
  return `#${value.map((part) => part.toString(16).padStart(2, '0')).join('')}`
}

/** Sample the ramp and wrap, so a phase shift cycles the same palette. */
export function sampleRampWrapped(stops: Stop[], t: number): string {
  const u = ((t % 1) + 1) % 1
  if (u <= stops[0].position) return stops[0].color
  let previous = stops[0]
  for (let index = 1; index < stops.length; index += 1) {
    const stop = stops[index]
    if (u <= stop.position) {
      const span = stop.position - previous.position
      const amount = span === 0 ? 0 : (u - previous.position) / span
      return mixHex(previous.color, stop.color, amount)
    }
    previous = stop
  }
  return stops[stops.length - 1].color
}

/** Sample the ramp. Clamped, so a petal at the edge holds the end color. */
export function sampleRamp(stops: Stop[], t: number): string {
  const u = Math.min(1, Math.max(0, t))
  if (u <= stops[0].position) return stops[0].color
  for (let index = 1; index < stops.length; index += 1) {
    const previous = stops[index - 1]
    const stop = stops[index]
    if (u <= stop.position) {
      const span = stop.position - previous.position
      const amount = span === 0 ? 0 : (u - previous.position) / span
      return mixHex(previous.color, stop.color, amount)
    }
  }
  return stops[stops.length - 1].color
}

export type Palette = {
  id: string
  name: string
  /** Five colors shown in the selector. */
  swatch: string[]
  /** Eight art-directed stops. Count stays fixed so palette changes do not recompile. */
  stops: Stop[]
}

function stops(pairs: [string, number][]): Stop[] {
  return pairs.map(([color, position]) => ({ color, position }))
}

export const palettes: Palette[] = [
  {
    id: 'bloom',
    name: 'Chromatic bloom',
    swatch: ['#211B55', '#4B69FF', '#4CCB66', '#FFE2A5', '#FF477F'],
    stops: stops([
      ['#211B55', 0],
      ['#211B55', 0.14],
      ['#4B69FF', 0.3],
      ['#4CCB66', 0.4],
      ['#7EE08A', 0.48],
      ['#FFE2A5', 0.58],
      ['#FFE2A5', 0.7],
      ['#FF477F', 1],
    ]),
  },
  {
    id: 'acid',
    name: 'Acid garden',
    swatch: ['#162B58', '#0A9A72', '#A6EA3B', '#F9E7BB', '#FF3D75'],
    stops: stops([
      ['#162B58', 0],
      ['#0A9A72', 0.18],
      ['#0A9A72', 0.32],
      ['#A6EA3B', 0.44],
      ['#F9E7BB', 0.56],
      ['#F9E7BB', 0.68],
      ['#FF3D75', 0.82],
      ['#FF3D75', 1],
    ]),
  },
  {
    id: 'sorbet',
    name: 'Electric sorbet',
    swatch: ['#2D46D8', '#77C7FF', '#FAE7CC', '#FF986B', '#F13C91'],
    stops: stops([
      ['#2D46D8', 0],
      ['#2D46D8', 0.16],
      ['#77C7FF', 0.34],
      ['#FAE7CC', 0.48],
      ['#FAE7CC', 0.6],
      ['#FF986B', 0.74],
      ['#F13C91', 0.88],
      ['#F13C91', 1],
    ]),
  },
  {
    id: 'aurora',
    name: 'Aurora',
    swatch: ['#262273', '#0F7E79', '#7EE8CD', '#E9F2C9', '#B29CFF'],
    stops: stops([
      ['#262273', 0],
      ['#262273', 0.12],
      ['#0F7E79', 0.28],
      ['#7EE8CD', 0.42],
      ['#E9F2C9', 0.56],
      ['#E9F2C9', 0.68],
      ['#B29CFF', 0.84],
      ['#B29CFF', 1],
    ]),
  },
  {
    id: 'ember',
    name: 'Ember orchid',
    swatch: ['#3B185C', '#B244BD', '#FF7D8A', '#FFDDA0', '#4D5DBE'],
    stops: stops([
      ['#3B185C', 0],
      ['#3B185C', 0.16],
      ['#4D5DBE', 0.3],
      ['#B244BD', 0.44],
      ['#FF7D8A', 0.58],
      ['#FFDDA0', 0.7],
      ['#FFDDA0', 0.82],
      ['#FF7D8A', 1],
    ]),
  },
  {
    id: 'flare',
    name: 'Fiery flare',
    swatch: ['#1B1464', '#E10600', '#FF4D1C', '#FFB703', '#FFE566'],
    stops: stops([
      ['#1B1464', 0],
      ['#1B1464', 0.12],
      ['#E10600', 0.28],
      ['#FF4D1C', 0.42],
      ['#FF4D1C', 0.55],
      ['#FFB703', 0.7],
      ['#FFE566', 0.84],
      ['#FFE566', 1],
    ]),
  },
  {
    id: 'sunset',
    name: 'Sunset neon',
    swatch: ['#2A0A4A', '#FF2E63', '#FF6B2C', '#FFC857', '#7A5CFF'],
    stops: stops([
      ['#2A0A4A', 0],
      ['#7A5CFF', 0.16],
      ['#FF2E63', 0.34],
      ['#FF2E63', 0.48],
      ['#FF6B2C', 0.62],
      ['#FFC857', 0.76],
      ['#FFC857', 0.88],
      ['#FF6B2C', 1],
    ]),
  },
  {
    id: 'toxic',
    name: 'Toxic bloom',
    swatch: ['#140028', '#C6FF00', '#39FF14', '#00F0FF', '#FF2BD6'],
    stops: stops([
      ['#140028', 0],
      ['#3B0070', 0.14],
      ['#FF2BD6', 0.3],
      ['#00F0FF', 0.44],
      ['#39FF14', 0.58],
      ['#C6FF00', 0.72],
      ['#C6FF00', 0.86],
      ['#FF2BD6', 1],
    ]),
  },
  {
    id: 'chrome',
    name: 'Cool chrome',
    swatch: ['#D7E4F5', '#B9C7FF', '#F4D7E8', '#F7F1E8', '#8E7CC3'],
    stops: stops([
      ['#8E7CC3', 0],
      ['#B9C7FF', 0.18],
      ['#D7E4F5', 0.34],
      ['#F7F1E8', 0.5],
      ['#F7F1E8', 0.64],
      ['#F4D7E8', 0.78],
      ['#D7E4F5', 0.9],
      ['#8E7CC3', 1],
    ]),
  },
  {
    id: 'nocturne',
    name: 'Nocturne',
    swatch: ['#12081F', '#1E3A8A', '#C2410C', '#F3C6A5', '#B7F3D8'],
    stops: stops([
      ['#12081F', 0],
      ['#12081F', 0.16],
      ['#1E3A8A', 0.32],
      ['#1E3A8A', 0.46],
      ['#C2410C', 0.6],
      ['#F3C6A5', 0.74],
      ['#F3C6A5', 0.86],
      ['#B7F3D8', 1],
    ]),
  },
]

export const defaultPaletteId = 'bloom'

export function paletteById(id: string): Palette {
  return palettes.find((palette) => palette.id === id) ?? palettes[0]
}
