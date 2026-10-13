import { bloomDefaults, materialDefaults, type MaterialKnobs } from './approaches'
import { balancedTiming } from './loop-clock'

/**
 * The locked export look. Preview and the offline renderer both read this.
 * Motion is 0.30 here. The lab's own default stays at 0.
 */
export const exportLook = {
  paletteId: 'sunset',
  surface: 'soft' as const,
  knobs: {
    ...materialDefaults,
    motion: 0.3,
  } satisfies MaterialKnobs,
  bloom: { ...bloomDefaults },
}

export const groundColors = {
  dark: '#0b1d3a',
  light: '#f3efe6',
} as const

export type GroundMode = keyof typeof groundColors

export type ExportJob = {
  ground: GroundMode
  startPhase: number
  seconds: number
  tumbleCycles: number
  gradientCycles: number
  fps: number
  size: number
  crf: number
}

export const defaultExportJob: ExportJob = {
  ground: 'dark',
  startPhase: 0,
  seconds: balancedTiming.seconds,
  tumbleCycles: balancedTiming.tumbleCycles,
  gradientCycles: balancedTiming.gradientCycles,
  fps: 30,
  size: 1024,
  crf: 18,
}

const sizes = [768, 1024, 1536]
const rates = [24, 30]

export function parseExportJob(value: unknown): ExportJob {
  if (!value || typeof value !== 'object') throw new Error('Export config must be an object')
  const raw = value as Record<string, unknown>
  const job: ExportJob = { ...defaultExportJob }

  if (raw.ground === 'dark' || raw.ground === 'light') job.ground = raw.ground
  else if (raw.ground !== undefined) throw new Error('Background must be dark or light')

  if (raw.startPhase !== undefined) {
    const phase = Number(raw.startPhase)
    if (!Number.isFinite(phase) || phase < 0 || phase > 1) throw new Error('Start phase must be between 0 and 1')
    job.startPhase = phase
  }

  if (raw.seconds !== undefined) {
    const seconds = Number(raw.seconds)
    if (!Number.isFinite(seconds) || seconds < 1 || seconds > 240) throw new Error('Duration must be between 1 and 240 seconds')
    job.seconds = Math.round(seconds)
  }

  if (raw.tumbleCycles !== undefined) {
    const cycles = Number(raw.tumbleCycles)
    if (!Number.isInteger(cycles) || cycles < 1) throw new Error('Tumble cycles must be a positive integer')
    job.tumbleCycles = cycles
  }

  if (raw.gradientCycles !== undefined) {
    const cycles = Number(raw.gradientCycles)
    if (!Number.isInteger(cycles) || cycles < 1) throw new Error('Gradient cycles must be a positive integer')
    job.gradientCycles = cycles
  }

  if (raw.fps !== undefined) {
    const fps = Number(raw.fps)
    if (!rates.includes(fps)) throw new Error('FPS must be 24 or 30')
    job.fps = fps
  }

  if (raw.size !== undefined) {
    const size = Number(raw.size)
    if (!sizes.includes(size)) throw new Error('Resolution must be 768, 1024, or 1536')
    job.size = size
  }

  if (raw.crf !== undefined) {
    const crf = Number(raw.crf)
    if (!Number.isFinite(crf) || crf < 0 || crf > 51) throw new Error('CRF must be between 0 and 51')
    job.crf = Math.round(crf)
  }

  return job
}

export function fileStem(job: ExportJob) {
  const phaseLabel = job.startPhase.toFixed(3).replace('.', '_')
  return `nolume-sunset-soft-${job.ground}-p${phaseLabel}-${job.size}`
}
