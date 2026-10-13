import type { MaterialKnobs } from './approaches'

/**
 * Export clock. The playground still uses its own speeds in main.ts.
 * One counted cycle is a full sine period, out and back, so velocity matches
 * at the join. A half period would only reach the reversal.
 */
export type LoopTiming = {
  id: 'short' | 'balanced' | 'extended'
  label: string
  seconds: number
  tumbleCycles: number
  gradientCycles: number
}

export const loopPresets: LoopTiming[] = [
  { id: 'short', label: 'Short', seconds: 45, tumbleCycles: 3, gradientCycles: 2 },
  { id: 'balanced', label: 'Balanced', seconds: 60, tumbleCycles: 4, gradientCycles: 3 },
  { id: 'extended', label: 'Extended', seconds: 75, tumbleCycles: 5, gradientCycles: 4 },
]

export const balancedTiming = loopPresets[1]

export function frameCount(seconds: number, fps: number) {
  return Math.max(1, Math.round(seconds * fps))
}

/** Fraction along the file. Frame i of N is i/N, never N/N. */
export function frameLoopPhase(index: number, count: number, startPhase: number) {
  return startPhase + index / count
}

export function poseFromLoop(
  loopPhase: number,
  timing: { tumbleCycles: number; gradientCycles: number },
  knobs: MaterialKnobs,
) {
  const tumblePhase = loopPhase * timing.tumbleCycles
  const gradientPhase = loopPhase * timing.gradientCycles
  const tumble = 20 + Math.sin(tumblePhase * Math.PI * 2) * 38
  const drift = Math.sin(gradientPhase * Math.PI * 2) * knobs.motion * 0.5
  return { tumble, drift, tumblePhase, gradientPhase }
}

export function poseStep(
  loopPhase: number,
  step: number,
  timing: { tumbleCycles: number; gradientCycles: number },
  knobs: MaterialKnobs,
) {
  const a = poseFromLoop(loopPhase, timing, knobs)
  const b = poseFromLoop(loopPhase + step, timing, knobs)
  return { tumble: b.tumble - a.tumble, drift: b.drift - a.drift }
}

/** Pose and velocity at the join. The frame after the last one is startPhase + 1. */
export function seamPose(
  startPhase: number,
  count: number,
  timing: { tumbleCycles: number; gradientCycles: number },
  knobs: MaterialKnobs,
) {
  const step = 1 / count
  const first = poseFromLoop(startPhase, timing, knobs)
  const closed = poseFromLoop(startPhase + 1, timing, knobs)
  const forward = poseStep(startPhase - step / 2, step, timing, knobs)
  const wrap = poseStep(startPhase + 1 - step / 2, step, timing, knobs)
  return {
    poseClosed: Math.abs(closed.tumble - first.tumble) < 1e-6 && Math.abs(closed.drift - first.drift) < 1e-8,
    motionClosed: Math.abs(forward.tumble - wrap.tumble) < 1e-4 && Math.abs(forward.drift - wrap.drift) < 1e-6,
  }
}
