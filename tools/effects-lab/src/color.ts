export type RGBA = [number, number, number, number]

export function normalizeHex(input: string): string | null {
  const raw = input.trim().replace(/^#/, '')
  if (/^[0-9a-fA-F]{3}$/.test(raw)) {
    const full = raw.split('').map((char) => char + char).join('')
    return `#${full.toLowerCase()}`
  }
  if (/^[0-9a-fA-F]{6}$/.test(raw)) return `#${raw.toLowerCase()}`
  return null
}

export function hexToBytes(hex: string): [number, number, number] {
  const normal = normalizeHex(hex) ?? '#000000'
  const value = Number.parseInt(normal.slice(1), 16)
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255]
}

export function formatCssColor(hex: string, alpha?: number): string {
  const normal = normalizeHex(hex) ?? '#000000'
  if (alpha === undefined || alpha >= 0.999) return normal
  const [red, green, blue] = hexToBytes(normal)
  const rounded = Math.round(Math.min(1, Math.max(0, alpha)) * 1000) / 1000
  return `rgba(${red}, ${green}, ${blue}, ${rounded})`
}

export function parseColor(input: string): RGBA {
  const trimmed = input.trim()
  const rgba = trimmed.match(
    /^rgba\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*\)$/i,
  )
  if (rgba) {
    return [
      clampByte(Number(rgba[1])) / 255,
      clampByte(Number(rgba[2])) / 255,
      clampByte(Number(rgba[3])) / 255,
      clampUnit(Number(rgba[4])),
    ]
  }

  const hex = normalizeHex(trimmed)
  if (!hex) return [1, 1, 1, 1]
  const [red, green, blue] = hexToBytes(hex)
  return [red / 255, green / 255, blue / 255, 1]
}

function clampByte(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.min(255, Math.max(0, value))
}

function clampUnit(value: number): number {
  if (!Number.isFinite(value)) return 1
  return Math.min(1, Math.max(0, value))
}
