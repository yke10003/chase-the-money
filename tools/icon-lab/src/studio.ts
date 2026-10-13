import { createShader, type ShaderInstance } from 'shaders/js'
import type { ComponentConfig } from 'shaders/js'
import { geometryKey } from './concepts'
import { paintMark, paintToCanvas } from './paint'
import type { Concept, Mark, Params, RenderMode } from './types'

const STRUCTURAL = new Set(['shape', 'colorSpace', 'cutout', 'shapeSdfUrl', 'shapeType', 'stops'])

function waitFrames(count: number): Promise<void> {
  return new Promise((resolve) => {
    const step = (left: number) => {
      if (left <= 0) {
        resolve()
        return
      }
      requestAnimationFrame(() => step(left - 1))
    }
    step(count)
  })
}

function fitCpu(canvas: HTMLCanvasElement, frame: HTMLElement) {
  const rect = frame.getBoundingClientRect()
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  const width = Math.max(1, Math.round(rect.width * dpr))
  const height = Math.max(1, Math.round(rect.height * dpr))
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width
    canvas.height = height
  }
}

function syncShader(shader: ShaderInstance, components: ComponentConfig[]) {
  for (const component of components) {
    if (!component.id || !component.props) continue
    const next: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(component.props)) {
      if (STRUCTURAL.has(key)) continue
      next[key] = value
    }
    if (component.props.stops) next.stops = component.props.stops
    shader.update(component.id, next)
  }
}

async function mountShader(
  canvas: HTMLCanvasElement,
  components: ComponentConfig[],
  observeElement: boolean,
): Promise<ShaderInstance> {
  let ready = false
  let failure: string | null = null
  const shader = await createShader(
    canvas,
    { components },
    {
      disableTelemetry: true,
      observeElement,
      onReady: () => {
        ready = true
      },
      onError: (reason) => {
        failure = reason
      },
    },
  )
  const started = performance.now()
  while (!ready && !failure && !shader.getFailureReason() && performance.now() - started < 20000) {
    await waitFrames(1)
  }
  const reason = failure ?? shader.getFailureReason()
  if (reason) {
    shader.destroy()
    throw new Error(reason)
  }
  await waitFrames(2)
  return shader
}

export function canvasHasInk(canvas: HTMLCanvasElement): boolean {
  const probe = document.createElement('canvas')
  probe.width = 8
  probe.height = 8
  const ctx = probe.getContext('2d', { willReadFrequently: true })
  if (!ctx) return false
  ctx.drawImage(canvas, 0, 0, 8, 8)
  const data = ctx.getImageData(0, 0, 8, 8).data
  let opaque = 0
  let spread = 0
  let first = data[0] + data[1] + data[2]
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] > 16) opaque += 1
    const sum = data[i] + data[i + 1] + data[i + 2]
    spread += Math.abs(sum - first)
  }
  return opaque > 4 && spread > 30
}

function cornerAlpha(canvas: HTMLCanvasElement): number {
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return 0
  const points = [
    [2, 2],
    [canvas.width - 3, 2],
    [2, canvas.height - 3],
    [canvas.width - 3, canvas.height - 3],
  ]
  let min = 255
  for (const [x, y] of points) {
    const alpha = ctx.getImageData(x, y, 1, 1).data[3]
    if (alpha < min) min = alpha
  }
  return min
}

function colorVariance(canvas: HTMLCanvasElement): number {
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return 0
  const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height)
  let count = 0
  let mean = 0
  let m2 = 0
  for (let i = 0; i < data.length; i += 48 * 4) {
    const luma = data[i] + data[i + 1] + data[i + 2]
    count += 1
    const delta = luma - mean
    mean += delta / count
    m2 += delta * (luma - mean)
  }
  if (count === 0) return 0
  return m2 / count
}

async function blobFromCanvas(canvas: HTMLCanvasElement): Promise<Blob> {
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
  if (!blob) throw new Error('PNG export failed')
  return blob
}

async function downscaleTo1024(source: HTMLCanvasElement): Promise<HTMLCanvasElement> {
  const blob = await blobFromCanvas(source)
  const bitmap = await createImageBitmap(blob)
  const width = bitmap.width
  const height = bitmap.height
  if (width < 1024 || height < 1024) {
    bitmap.close()
    throw new Error(`Renderer buffer is ${width}×${height}. Refusing to upscale.`)
  }
  const out = document.createElement('canvas')
  out.width = 1024
  out.height = 1024
  const ctx = out.getContext('2d', { willReadFrequently: true })
  if (!ctx) {
    bitmap.close()
    throw new Error('2D canvas unavailable')
  }
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(bitmap, 0, 0, 1024, 1024)
  bitmap.close()
  return out
}

export class MarkView {
  private shader: ShaderInstance | null = null
  private key = ''
  private generation = 0
  private failed = false
  mark: Mark | null = null

  constructor(
    private frame: HTMLElement,
    readonly gpu: HTMLCanvasElement,
    readonly cpu: HTMLCanvasElement,
  ) {}

  get shaderFailed(): boolean {
    return this.failed
  }

  paint(mark: Mark, params: Params) {
    fitCpu(this.cpu, this.frame)
    paintMark(this.cpu, mark, params)
  }

  async show(concept: Concept, params: Params, mode: RenderMode): Promise<void> {
    const mark = concept.compose(params)
    this.mark = mark
    this.paint(mark, params)
    this.frame.classList.toggle('force-paint', mode === 'paint')
    if (mode === 'paint') return

    const key = geometryKey(concept, params)
    if (this.failed && key === this.key) return
    if (this.shader && key === this.key && !this.failed) {
      syncShader(this.shader, mark.components)
      this.frame.classList.remove('wait')
      return
    }

    const generation = ++this.generation
    this.shader?.destroy()
    this.shader = null
    this.failed = false
    this.key = key
    this.frame.classList.add('wait')

    try {
      const shader = await mountShader(this.gpu, mark.components, true)
      if (generation !== this.generation) {
        shader.destroy()
        return
      }
      shader.resize()
      await waitFrames(2)
      this.shader = shader
      this.frame.classList.remove('wait')
    } catch (error) {
      if (generation !== this.generation) return
      this.failed = true
      this.frame.classList.add('wait')
      throw error
    }
  }

  setLight(base: number) {
    if (!this.mark) return
    for (const shape of this.mark.vectors) {
      this.shader?.update(shape.id, { lightAngle: base + shape.lightOffset })
    }
  }

  destroy() {
    this.generation += 1
    this.shader?.destroy()
    this.shader = null
  }
}

export type IconRender = {
  canvas: HTMLCanvasElement
  renderer: 'shader' | 'paint'
  note: string
}

async function captureShader(components: ComponentConfig[]): Promise<HTMLCanvasElement> {
  const gpu = document.createElement('canvas')
  gpu.width = 1024
  gpu.height = 1024
  gpu.style.cssText = 'position:fixed;left:0;top:0;width:1024px;height:1024px;z-index:-1;pointer-events:none;'
  document.body.appendChild(gpu)
  let shader: ShaderInstance | null = null
  try {
    shader = await mountShader(gpu, components, false)
    shader.resize(1024, 1024)
    for (let frame = 0; frame < 40 && (gpu.width < 1024 || gpu.height < 1024); frame += 1) {
      await waitFrames(1)
    }
    shader.pause()
    if (gpu.width < 1024 || gpu.height < 1024) {
      throw new Error(
        `Renderer buffer is ${gpu.width}×${gpu.height}. The shader caps drawing to the window (${window.innerWidth}×${window.innerHeight}).`,
      )
    }
    return await downscaleTo1024(gpu)
  } finally {
    shader?.destroy()
    gpu.remove()
  }
}

function fillTransparentCorners(canvas: HTMLCanvasElement, color: string) {
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.save()
  ctx.globalCompositeOperation = 'destination-over'
  ctx.fillStyle = color
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.restore()
}

export async function renderIcon(concept: Concept, params: Params, mode: RenderMode): Promise<IconRender> {
  const mark = concept.compose(params)
  if (mode === 'paint') {
    return {
      canvas: paintToCanvas(mark, params, 1024),
      renderer: 'paint',
      note: 'Painted approximation. Gloss, inner shade, and lens zoom are canvas draws, not shaders.',
    }
  }

  try {
    let canvas = await captureShader(mark.components)
    const hasGlass = mark.components.some((component) => component.type === 'Glass')
    if (cornerAlpha(canvas) < 250 && hasGlass) {
      const bodies = mark.components.filter((component) => component.type !== 'Glass')
      const base = await captureShader(bodies)
      fillTransparentCorners(base, mark.background)
      const ctx = base.getContext('2d')
      ctx?.drawImage(canvas, 0, 0)
      canvas = base
    }
    fillTransparentCorners(canvas, mark.background)
    const alpha = cornerAlpha(canvas)
    const variance = colorVariance(canvas)
    if (alpha < 250) throw new Error(`background is not opaque (alpha ${alpha})`)
    if (variance < 40) throw new Error('shader frame has no visible variation')
    const note = hasGlass
      ? 'WebGPU shader frame. Plastic shapes, then a Glass lens composited on top so the square stays opaque. Scaled to exactly 1024×1024.'
      : 'WebGPU shader frame from the shaders package (Plastic), scaled to exactly 1024×1024.'
    return { canvas, renderer: 'shader', note }
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'shader failed'
    return {
      canvas: paintToCanvas(mark, params, 1024),
      renderer: 'paint',
      note: `Shader export failed (${reason}). This PNG is the painted approximation.`,
    }
  }
}
