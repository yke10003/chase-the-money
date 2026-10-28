import { formatCssColor } from './color'
import { LIBRARY_VERSION, type EffectDef, type ValueMap } from './catalog'

export type ExportedProps = Record<string, string | number>

export function exportedProps(effect: EffectDef, values: ValueMap): ExportedProps {
  const props: ExportedProps = {}
  for (const control of effect.controls) {
    if (control.kind === 'number') {
      props[control.key] = Number(values[control.key])
      continue
    }
    const alpha = control.alpha ? Number(values[`${control.key}Alpha`]) : undefined
    props[control.key] = formatCssColor(String(values[control.key]), alpha)
  }
  return props
}

export function toJson(effect: EffectDef, values: ValueMap): string {
  return `${JSON.stringify(
    {
      library: 'react-native-effects',
      version: LIBRARY_VERSION,
      effect: effect.component,
      props: exportedProps(effect, values),
    },
    null,
    2,
  )}\n`
}

export function toTsx(effect: EffectDef, values: ValueMap): string {
  const lines = Object.entries(exportedProps(effect, values)).map(([key, value]) => {
    if (typeof value === 'number') return `  ${key}={${formatNumber(value)}}`
    return `  ${key}=${JSON.stringify(value)}`
  })
  lines.push("  style={{ width: '100%', height: 400 }}")
  return `import { ${effect.component} } from 'react-native-effects'\n\n<${effect.component}\n${lines.join('\n')}\n/>\n`
}

function formatNumber(value: number): string {
  if (!Number.isFinite(value)) return '0'
  const rounded = Math.round(value * 1000) / 1000
  return String(rounded)
}
