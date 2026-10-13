import { bloomLayerOrder, bloomScene, isolatedPetalScene } from './approaches'
import { exportLook, groundColors } from './export-config'
import { mountShader, paintTwice } from './export-scene'
import { poseFromLoop } from './loop-clock'
import { paletteById } from './palettes'
import type { ComponentConfig, ShaderInstance } from 'shaders/js'

const size = 1024
const canvas = document.querySelector('#frame') as HTMLCanvasElement
const palette = paletteById(exportLook.paletteId)

type LayerFile = { id: string; depth: number; order: number; fileName: string }

type IconReport = {
  layers: LayerFile[]
  tumble: number
  drift: number
  transparent: number
  opaque: number
  partial: number
  againstGlow: number
  againstBare: number
}

let shader: ShaderInstance | null = null
let sink = ''
let layers: LayerFile[] = []
let tumble = 20
let drift = 0

function poseAt(phase: number, tumbleCycles: number, gradientCycles: number) {
  return poseFromLoop(phase, { tumbleCycles, gradientCycles }, exportLook.knobs)
}

async function mount(components: ComponentConfig[]) {
  shader?.destroy()
  shader = await mountShader(canvas, components)
  shader.resize(size, size)
  await paintTwice()
  await paintTwice()
  if (canvas.width !== size || canvas.height !== size) {
    throw new Error(`Buffer is ${canvas.width}×${canvas.height}. Need ${size}.`)
  }
}

async function pixels() {
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
  if (!blob) throw new Error('Frame capture failed')
  const bitmap = await createImageBitmap(blob)
  const exact = document.createElement('canvas')
  exact.width = size
  exact.height = size
  const ctx = exact.getContext('2d', { willReadFrequently: true })
  if (!ctx) throw new Error('2D canvas unavailable')
  ctx.drawImage(bitmap, 0, 0, size, size)
  bitmap.close()
  return { canvas: exact, data: ctx.getImageData(0, 0, size, size).data }
}

async function postPng(name: string, blob: Blob) {
  const response = await fetch(sink, {
    method: 'POST',
    headers: { 'x-name': name },
    body: blob,
  })
  if (!response.ok) throw new Error(`Could not store ${name}`)
}

function canvasBlob(source: HTMLCanvasElement) {
  return new Promise<Blob>((resolve, reject) => {
    source.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('PNG export failed'))), 'image/png')
  })
}

/** Recover straight RGBA from the same petal drawn on black and on white. */
function extractAlpha(black: Uint8ClampedArray, white: Uint8ClampedArray) {
  const out = document.createElement('canvas')
  out.width = size
  out.height = size
  const ctx = out.getContext('2d')
  if (!ctx) throw new Error('2D canvas unavailable')
  const image = ctx.createImageData(size, size)
  const data = image.data
  let transparent = 0
  let opaque = 0
  let partial = 0
  for (let index = 0; index < black.length; index += 4) {
    const br = black[index] / 255
    const bg = black[index + 1] / 255
    const bb = black[index + 2] / 255
    const wr = white[index] / 255
    const wg = white[index + 1] / 255
    const wb = white[index + 2] / 255
    let alpha = (3 - ((wr - br) + (wg - bg) + (wb - bb))) / 3
    if (alpha < 0) alpha = 0
    if (alpha > 1) alpha = 1
    const byte = Math.round(alpha * 255)
    if (byte === 0) {
      transparent += 1
      continue
    }
    if (byte === 255) opaque += 1
    else partial += 1
    data[index] = Math.round(Math.min(255, (br / alpha) * 255))
    data[index + 1] = Math.round(Math.min(255, (bg / alpha) * 255))
    data[index + 2] = Math.round(Math.min(255, (bb / alpha) * 255))
    data[index + 3] = byte
  }
  ctx.putImageData(image, 0, 0)
  return { canvas: out, transparent, opaque, partial }
}

function meanDelta(a: Uint8ClampedArray, b: Uint8ClampedArray) {
  let sum = 0
  const pixels = size * size
  for (let index = 0; index < a.length; index += 4) {
    sum += Math.abs(a[index] - b[index])
    sum += Math.abs(a[index + 1] - b[index + 1])
    sum += Math.abs(a[index + 2] - b[index + 2])
  }
  return sum / (pixels * 3)
}

function solid(color: string) {
  const plate = document.createElement('canvas')
  plate.width = size
  plate.height = size
  const ctx = plate.getContext('2d')
  if (!ctx) throw new Error('2D canvas unavailable')
  ctx.fillStyle = color
  ctx.fillRect(0, 0, size, size)
  return plate
}

function composite(petalCanvases: HTMLCanvasElement[], ground: string) {
  const plate = solid(ground)
  const ctx = plate.getContext('2d')
  if (!ctx) throw new Error('2D canvas unavailable')
  for (const petal of petalCanvases) ctx.drawImage(petal, 0, 0)
  return plate
}

async function scenePixels(components: ComponentConfig[]) {
  await mount(components)
  return pixels()
}

async function exportLayers(request: {
  phase: number
  tumbleCycles: number
  gradientCycles: number
  sink: string
}): Promise<IconReport> {
  sink = request.sink
  const pose = poseAt(request.phase, request.tumbleCycles, request.gradientCycles)
  tumble = pose.tumble
  drift = pose.drift
  layers = bloomLayerOrder(exportLook.bloom)
  const knobs = exportLook.knobs
  const bloom = exportLook.bloom
  const surface = exportLook.surface

  const glow = await scenePixels(bloomScene(knobs, palette, bloom, drift, surface, tumble, groundColors.dark, true))
  await postPng('preview/complete-bloom.png', await canvasBlob(glow.canvas))
  const bare = await scenePixels(bloomScene(knobs, palette, bloom, drift, surface, tumble, groundColors.dark, false))

  await postPng('background/background-dark.png', await canvasBlob(solid(groundColors.dark)))
  await postPng('background/background-light.png', await canvasBlob(solid(groundColors.light)))

  const petalCanvases: HTMLCanvasElement[] = []
  let transparent = 0
  let opaque = 0
  let partial = 0
  for (const layer of layers) {
    const onBlack = await scenePixels(isolatedPetalScene(
      knobs, palette, bloom, drift, surface, tumble, layer.id, '#000000',
    ))
    const onWhite = await scenePixels(isolatedPetalScene(
      knobs, palette, bloom, drift, surface, tumble, layer.id, '#ffffff',
    ))
    const extracted = extractAlpha(onBlack.data, onWhite.data)
    if (extracted.transparent === 0) throw new Error(`${layer.fileName} has no transparent pixels`)
    transparent += extracted.transparent
    opaque += extracted.opaque
    partial += extracted.partial
    petalCanvases.push(extracted.canvas)
    await postPng(`petals/${layer.fileName}`, await canvasBlob(extracted.canvas))
  }

  const rebuilt = composite(petalCanvases, groundColors.dark)
  await postPng('preview/reconstructed-bloom.png', await canvasBlob(rebuilt))
  const rebuiltData = rebuilt.getContext('2d')?.getImageData(0, 0, size, size).data
  if (!rebuiltData) throw new Error('Could not read the reconstruction')
  const difference = document.createElement('canvas')
  difference.width = size
  difference.height = size
  const diffCtx = difference.getContext('2d')
  if (!diffCtx) throw new Error('2D canvas unavailable')
  const diffImage = diffCtx.createImageData(size, size)
  for (let index = 0; index < rebuiltData.length; index += 4) {
    diffImage.data[index] = Math.abs(rebuiltData[index] - bare.data[index])
    diffImage.data[index + 1] = Math.abs(rebuiltData[index + 1] - bare.data[index + 1])
    diffImage.data[index + 2] = Math.abs(rebuiltData[index + 2] - bare.data[index + 2])
    diffImage.data[index + 3] = 255
  }
  diffCtx.putImageData(diffImage, 0, 0)
  await postPng('preview/difference.png', await canvasBlob(difference))

  return {
    layers,
    tumble,
    drift,
    transparent,
    opaque,
    partial,
    againstGlow: meanDelta(rebuiltData, glow.data),
    againstBare: meanDelta(rebuiltData, bare.data),
  }
}

window.__nolumeIcon = {
  ready: true,
  exportLayers,
}

declare global {
  interface Window {
    __nolumeIcon: {
      ready: boolean
      exportLayers(request: {
        phase: number
        tumbleCycles: number
        gradientCycles: number
        sink: string
      }): Promise<IconReport>
    }
  }
}
