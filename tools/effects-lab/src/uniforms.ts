import type { RGBA } from './color'

/** 6 vec4s. Matches the Uniforms struct declared by every built-in shader. */
export const UNIFORM_FLOATS = 24
export const UNIFORM_BYTES = UNIFORM_FLOATS * 4

export type UniformWrite = {
  width: number
  height: number
  dpr: number
  time: number
  dt: number
  color0: RGBA
  color1: RGBA
  params: number[]
}

/**
 * Packs the same slots as ShaderView in react-native-effects:
 * resolution, time, color0, color1, params0, params1.
 * Built-in shaders do not read the later `live` region.
 */
export function writeUniforms(target: Float32Array, write: UniformWrite) {
  const width = Math.max(1, write.width)
  const height = Math.max(1, write.height)
  target[0] = width
  target[1] = height
  target[2] = width / height
  target[3] = write.dpr
  target[4] = write.time
  target[5] = write.dt
  target[6] = 0
  target[7] = 0
  target[8] = write.color0[0]
  target[9] = write.color0[1]
  target[10] = write.color0[2]
  target[11] = write.color0[3]
  target[12] = write.color1[0]
  target[13] = write.color1[1]
  target[14] = write.color1[2]
  target[15] = write.color1[3]
  for (let index = 0; index < 8; index += 1) {
    target[16 + index] = write.params[index] ?? 0
  }
}
