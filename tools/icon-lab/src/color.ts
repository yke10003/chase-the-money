export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

type Rgb = { r: number; g: number; b: number }

export function parseHex(input: string): Rgb {
  let hex = input.trim().replace('#', '')
  if (hex.length === 3) {
    hex = hex
      .split('')
      .map((channel) => channel + channel)
      .join('')
  }
  const value = Number.parseInt(hex, 16)
  if (!Number.isFinite(value) || hex.length !== 6) {
    return { r: 255, g: 255, b: 255 }
  }
  return {
    r: (value >> 16) & 255,
    g: (value >> 8) & 255,
    b: value & 255,
  }
}

export function toHex(r: number, g: number, b: number): string {
  const channel = (value: number) =>
    clamp(Math.round(value), 0, 255).toString(16).padStart(2, '0')
  return `#${channel(r)}${channel(g)}${channel(b)}`
}

export function mixHex(a: string, b: string, t: number): string {
  const from = parseHex(a)
  const to = parseHex(b)
  const mix = clamp(t, 0, 1)
  return toHex(
    from.r + (to.r - from.r) * mix,
    from.g + (to.g - from.g) * mix,
    from.b + (to.b - from.b) * mix,
  )
}

/** Positive amount moves toward white. Negative amount moves toward black. */
export function shade(hex: string, amount: number): string {
  if (amount >= 0) return mixHex(hex, '#ffffff', amount)
  return mixHex(hex, '#000000', -amount)
}

export function samplePalette(colors: string[], t: number): string {
  if (colors.length === 0) return '#ffffff'
  if (colors.length === 1) return colors[0]
  const scaled = clamp(t, 0, 1) * (colors.length - 1)
  const index = Math.floor(scaled)
  const from = colors[Math.min(index, colors.length - 1)]
  const to = colors[Math.min(index + 1, colors.length - 1)]
  return mixHex(from, to, scaled - index)
}

export function petalColors(colors: string[], index: number): { colorA: string; colorB: string } {
  const colorA = colors[index % colors.length]
  const next = colors[(index + 1) % colors.length]
  const deeper = shade(colorA, -0.38)
  const colorB = mixHex(deeper, next, 0.48)
  return { colorA, colorB }
}
