import triangleShader from './vendor/triangle.wgsl?raw'
import type { DrawState } from './catalog'
import { getGpuDevice } from './device'
import { UNIFORM_BYTES, UNIFORM_FLOATS, writeUniforms } from './uniforms'

const MAX_DPR = 2

export class PreviewRenderer {
  private device: GPUDevice | null = null
  private context: GPUCanvasContext | null = null
  private format: GPUTextureFormat = 'bgra8unorm'
  private vertexModule: GPUShaderModule | null = null
  private pipeline: GPURenderPipeline | null = null
  private uniformBuffer: GPUBuffer | null = null
  private bindGroup: GPUBindGroup | null = null
  private readonly uniformData = new Float32Array(UNIFORM_FLOATS)
  private shaderId: string | null = null
  private pendingShaderId: string | null = null
  private configured = false
  private disposed = false
  private ready = false
  private dpr = 1
  private accumulated = 0
  private lastTimestamp = 0
  private wasStatic = false
  private raf = 0
  private observer: ResizeObserver | null = null
  private rebuildToken = 0
  private lastError: string | null = null

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly getState: () => DrawState,
    private readonly onError: (message: string | null) => void,
  ) {}

  async start() {
    try {
      this.device = await getGpuDevice()
      if (this.disposed) return
      const context = this.canvas.getContext('webgpu')
      if (!context) throw new Error('Could not create a WebGPU canvas context.')
      this.context = context
      this.format = navigator.gpu.getPreferredCanvasFormat()
      this.vertexModule = this.device.createShaderModule({
        label: 'fullscreen-triangle',
        code: triangleShader,
      })
      this.ready = true
      this.observer = new ResizeObserver(() => {
        if (this.disposed || !this.pipeline || this.raf !== 0) return
        this.draw(performance.now(), false)
      })
      this.observer.observe(this.canvas)
      this.requestUpdate()
    } catch (error) {
      if (!this.disposed) this.report(errorText(error))
    }
  }

  requestUpdate() {
    if (!this.ready || this.disposed || !this.device) return
    const state = this.getState()
    if (this.pendingShaderId === state.shaderId || this.shaderId === state.shaderId) {
      if (this.pipeline && this.shaderId === state.shaderId) this.syncPlayback()
      return
    }
    this.pendingShaderId = state.shaderId
    void this.rebuild(state)
  }

  dispose() {
    this.disposed = true
    this.rebuildToken += 1
    this.stopLoop()
    this.observer?.disconnect()
    this.observer = null
    this.destroyPipeline()
    if (this.configured) this.context?.unconfigure()
    this.configured = false
    this.vertexModule = null
    this.device = null
    this.context = null
  }

  private async rebuild(state: DrawState) {
    const token = ++this.rebuildToken
    const device = this.device
    if (!device || this.disposed) return
    this.stopLoop()

    const module = device.createShaderModule({ label: state.shaderId, code: state.shader })
    const info = await module.getCompilationInfo()
    if (token !== this.rebuildToken || this.disposed) return
    const errors = info.messages.filter((message) => message.type === 'error')
    if (errors.length > 0) {
      this.shaderId = state.shaderId
      this.pendingShaderId = state.shaderId
      this.destroyPipeline()
      this.report(errors.map((message) => message.message).join('\n'))
      return
    }
    for (const message of info.messages) {
      if (message.type === 'warning') console.warn('[effects-lab]', state.shaderId, message.message)
    }

    let pipeline: GPURenderPipeline
    try {
      pipeline = device.createRenderPipeline({
        label: state.shaderId,
        layout: 'auto',
        vertex: { module: this.vertexModule!, entryPoint: 'main' },
        fragment: {
          module,
          entryPoint: 'main',
          targets: [{ format: this.format }],
        },
        primitive: { topology: 'triangle-list' },
      })
    } catch (error) {
      if (token !== this.rebuildToken || this.disposed) return
      this.shaderId = state.shaderId
      this.report(errorText(error))
      return
    }

    const uniformBuffer = device.createBuffer({
      label: `${state.shaderId}-uniforms`,
      size: UNIFORM_BYTES,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    })
    const bindGroup = device.createBindGroup({
      label: state.shaderId,
      layout: pipeline.getBindGroupLayout(0),
      entries: [{ binding: 0, resource: { buffer: uniformBuffer } }],
    })

    if (token !== this.rebuildToken || this.disposed) {
      uniformBuffer.destroy()
      return
    }

    this.destroyPipeline()
    this.pipeline = pipeline
    this.uniformBuffer = uniformBuffer
    this.bindGroup = bindGroup
    this.shaderId = state.shaderId
    this.pendingShaderId = state.shaderId
    this.accumulated = 0
    this.lastTimestamp = 0
    this.wasStatic = state.isStatic
    this.report(null)
    this.syncPlayback()
  }

  private syncPlayback() {
    const state = this.getState()
    if (this.wasStatic && !state.isStatic) {
      this.accumulated = 0
      this.lastTimestamp = 0
    }
    this.wasStatic = state.isStatic
    const hold = state.paused || state.isStatic
    if (hold) {
      this.stopLoop()
      this.draw(performance.now(), false)
      return
    }
    if (this.raf === 0) {
      this.lastTimestamp = 0
      this.raf = requestAnimationFrame(this.onFrame)
    }
  }

  private onFrame = (timestamp: number) => {
    this.raf = 0
    if (this.disposed || !this.pipeline) return
    const state = this.getState()
    if (state.shaderId !== this.shaderId) return
    if (state.paused || state.isStatic) {
      this.draw(timestamp, false)
      this.lastTimestamp = 0
      return
    }
    try {
      this.draw(timestamp, true)
    } catch (error) {
      this.report(errorText(error))
      return
    }
    if (!this.disposed) this.raf = requestAnimationFrame(this.onFrame)
  }

  private draw(timestamp: number, advance: boolean) {
    const device = this.device
    const context = this.context
    const pipeline = this.pipeline
    const uniformBuffer = this.uniformBuffer
    const bindGroup = this.bindGroup
    if (!device || !context || !pipeline || !uniformBuffer || !bindGroup) return
    if (!this.ensureSize()) return

    const state = this.getState()
    let dt = 0
    if (advance) {
      dt = this.lastTimestamp === 0 ? 0 : (timestamp - this.lastTimestamp) / 1000
      if (dt > 0.1) dt = 0.1
      this.lastTimestamp = timestamp
      this.accumulated += dt * state.shaderSpeed
    }

    writeUniforms(this.uniformData, {
      width: this.canvas.width,
      height: this.canvas.height,
      dpr: this.dpr,
      time: this.accumulated,
      dt: advance ? dt : 0,
      color0: state.color0,
      color1: state.color1,
      params: state.params,
    })

    device.queue.writeBuffer(uniformBuffer, 0, this.uniformData)
    const encoder = device.createCommandEncoder()
    const view = context.getCurrentTexture().createView()
    const pass = encoder.beginRenderPass({
      colorAttachments: [
        {
          view,
          clearValue: [0, 0, 0, 1],
          loadOp: 'clear',
          storeOp: 'store',
        },
      ],
    })
    pass.setPipeline(pipeline)
    pass.setBindGroup(0, bindGroup)
    pass.draw(3)
    pass.end()
    device.queue.submit([encoder.finish()])
  }

  private ensureSize(): boolean {
    const context = this.context
    const device = this.device
    if (!context || !device) return false
    const cssWidth = this.canvas.clientWidth
    const cssHeight = this.canvas.clientHeight
    if (cssWidth < 2 || cssHeight < 2) return false
    const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR)
    const width = Math.max(1, Math.round(cssWidth * dpr))
    const height = Math.max(1, Math.round(cssHeight * dpr))
    this.dpr = dpr
    if (this.configured && this.canvas.width === width && this.canvas.height === height) return true
    this.canvas.width = width
    this.canvas.height = height
    context.configure({
      device,
      format: this.format,
      alphaMode: 'premultiplied',
    })
    this.configured = true
    return true
  }

  private stopLoop() {
    if (this.raf !== 0) cancelAnimationFrame(this.raf)
    this.raf = 0
    this.lastTimestamp = 0
  }

  private destroyPipeline() {
    this.uniformBuffer?.destroy()
    this.uniformBuffer = null
    this.pipeline = null
    this.bindGroup = null
  }

  private report(message: string | null) {
    if (message === this.lastError) return
    this.lastError = message
    if (message) console.error('[effects-lab]', message)
    this.onError(message)
  }
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
