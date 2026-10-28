import triangleShader from './vendor/triangle.wgsl?raw'
import {
  EFFECTS,
  buildDrawState,
  defaultValues,
  type EffectId,
} from './catalog'
import { getGpuDevice, webgpuAvailable } from './device'
import { UNIFORM_BYTES, UNIFORM_FLOATS, writeUniforms } from './uniforms'

const SIZE = 128
const THUMB_TIME = 2.4
const listeners = new Set<(id: EffectId, url: string) => void>()
const ready = new Map<EffectId, string>()
let started = false

export function subscribeThumbnails(listener: (id: EffectId, url: string) => void): () => void {
  listeners.add(listener)
  for (const [id, url] of ready) listener(id, url)
  if (!started && webgpuAvailable()) {
    started = true
    void renderAll()
  }
  return () => {
    listeners.delete(listener)
  }
}

async function renderAll() {
  try {
    const device = await getGpuDevice()
    for (const effect of EFFECTS) {
      try {
        const url = await snapshot(device, effect.id)
        ready.set(effect.id, url)
        for (const listener of listeners) listener(effect.id, url)
      } catch (error) {
        console.error(`[effects-lab] Thumbnail failed for ${effect.component}:`, error)
      }
      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => resolve())
      })
    }
  } catch (error) {
    console.error('[effects-lab] Thumbnails stopped:', error)
  }
}

async function snapshot(device: GPUDevice, id: EffectId): Promise<string> {
  const effect = EFFECTS.find((item) => item.id === id)
  if (!effect) throw new Error(`Unknown effect ${id}`)
  const canvas = document.createElement('canvas')
  canvas.width = SIZE
  canvas.height = SIZE
  const context = canvas.getContext('webgpu')
  if (!context) throw new Error('Could not create a thumbnail WebGPU context.')
  const format = navigator.gpu.getPreferredCanvasFormat()
  context.configure({
    device,
    format,
    alphaMode: 'premultiplied',
    usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC,
  })

  const shaderModule = device.createShaderModule({ label: `${id}-thumb`, code: effect.shader })
  const compiled = await shaderModule.getCompilationInfo()
  const errors = compiled.messages.filter((message) => message.type === 'error')
  if (errors.length > 0) {
    context.unconfigure()
    throw new Error(errors.map((message) => message.message).join('\n'))
  }

  const pipeline = device.createRenderPipeline({
    label: `${id}-thumb`,
    layout: 'auto',
    vertex: {
      module: device.createShaderModule({ code: triangleShader }),
      entryPoint: 'main',
    },
    fragment: {
      module: shaderModule,
      entryPoint: 'main',
      targets: [{ format }],
    },
    primitive: { topology: 'triangle-list' },
  })
  const uniformBuffer = device.createBuffer({
    size: UNIFORM_BYTES,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  })
  const bindGroup = device.createBindGroup({
    layout: pipeline.getBindGroupLayout(0),
    entries: [{ binding: 0, resource: { buffer: uniformBuffer } }],
  })
  const bytesPerRow = Math.ceil((SIZE * 4) / 256) * 256
  const readBuffer = device.createBuffer({
    size: bytesPerRow * SIZE,
    usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
  })

  try {
    const state = buildDrawState(effect, defaultValues(effect), true)
    const uniforms = new Float32Array(UNIFORM_FLOATS)
    writeUniforms(uniforms, {
      width: SIZE,
      height: SIZE,
      dpr: 1,
      time: THUMB_TIME,
      dt: 0,
      color0: state.color0,
      color1: state.color1,
      params: state.params,
    })
    device.queue.writeBuffer(uniformBuffer, 0, uniforms)

    const encoder = device.createCommandEncoder()
    const texture = context.getCurrentTexture()
    const pass = encoder.beginRenderPass({
      colorAttachments: [
        {
          view: texture.createView(),
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
    encoder.copyTextureToBuffer(
      { texture },
      { buffer: readBuffer, bytesPerRow, rowsPerImage: SIZE },
      { width: SIZE, height: SIZE },
    )
    device.queue.submit([encoder.finish()])
    await readBuffer.mapAsync(GPUMapMode.READ)
    const copy = new Uint8Array(readBuffer.getMappedRange()).slice()
    readBuffer.unmap()
    return pixelsToPng(copy, bytesPerRow, format)
  } finally {
    uniformBuffer.destroy()
    if (readBuffer.mapState === 'mapped') readBuffer.unmap()
    readBuffer.destroy()
    context.unconfigure()
  }
}

function pixelsToPng(source: Uint8Array, bytesPerRow: number, format: GPUTextureFormat): string {
  const swap = format.startsWith('bgra')
  const image = document.createElement('canvas')
  image.width = SIZE
  image.height = SIZE
  const context = image.getContext('2d')
  if (!context) throw new Error('Could not create a thumbnail image.')
  const pixels = context.createImageData(SIZE, SIZE)
  for (let y = 0; y < SIZE; y += 1) {
    for (let x = 0; x < SIZE; x += 1) {
      const src = y * bytesPerRow + x * 4
      const dst = (y * SIZE + x) * 4
      let red = source[src] ?? 0
      let green = source[src + 1] ?? 0
      let blue = source[src + 2] ?? 0
      const alpha = source[src + 3] ?? 255
      if (swap) {
        const temp = red
        red = blue
        blue = temp
      }
      const cover = alpha / 255
      pixels.data[dst] = Math.round(red + 20 * (1 - cover))
      pixels.data[dst + 1] = Math.round(green + 22 * (1 - cover))
      pixels.data[dst + 2] = Math.round(blue + 28 * (1 - cover))
      pixels.data[dst + 3] = 255
    }
  }
  context.putImageData(pixels, 0, 0)
  return image.toDataURL('image/png')
}
