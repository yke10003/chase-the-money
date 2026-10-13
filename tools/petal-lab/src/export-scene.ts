import { createShader, type ComponentConfig, type ShaderInstance } from 'shaders/js'
import { bloomScene } from './approaches'
import { exportLook, groundColors, type ExportJob } from './export-config'
import { poseFromLoop } from './loop-clock'
import { paletteById } from './palettes'

export function sceneAt(job: ExportJob, loopPhase: number) {
  const pose = poseFromLoop(loopPhase, job, exportLook.knobs)
  return bloomScene(
    exportLook.knobs,
    paletteById(exportLook.paletteId),
    exportLook.bloom,
    pose.drift,
    exportLook.surface,
    pose.tumble,
    groundColors[job.ground],
  )
}

export function pushScene(shader: ShaderInstance, components: ComponentConfig[]) {
  const visit = (component: ComponentConfig) => {
    const props = component.props
    if (component.id && props) {
      const patch: Record<string, unknown> = {}
      if ('stops' in props && props.stops) {
        patch.stops = props.stops
        patch.colorA = props.colorA
        patch.colorB = props.colorB
      }
      if ('shape' in props && props.shape) {
        patch.shape = props.shape
        patch.rotation = props.rotation
      }
      if (Object.keys(patch).length > 0) shader.update(component.id, patch)
    }
    component.children?.forEach(visit)
  }
  components.forEach(visit)
}

export async function mountShader(canvas: HTMLCanvasElement, components: ComponentConfig[]) {
  let ready = false
  let failure: string | null = null
  const instance = await createShader(canvas, { components }, {
    disableTelemetry: true,
    onReady: () => {
      ready = true
    },
    onError: (reason) => {
      failure = reason
    },
  })
  const started = performance.now()
  while (!ready && !failure && !instance.getFailureReason() && performance.now() - started < 20000) {
    await new Promise((resolve) => requestAnimationFrame(() => resolve(null)))
  }
  const reason = failure ?? instance.getFailureReason()
  if (reason) {
    instance.destroy()
    throw new Error(reason)
  }
  return instance
}

export async function paintTwice() {
  await new Promise((resolve) => requestAnimationFrame(() => resolve(null)))
  await new Promise((resolve) => requestAnimationFrame(() => resolve(null)))
}
