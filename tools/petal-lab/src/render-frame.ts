import { exportLook, groundColors, parseExportJob, type ExportJob } from './export-config'
import { mountShader, paintTwice, pushScene, sceneAt } from './export-scene'
import { frameCount, frameLoopPhase, seamPose } from './loop-clock'
import type { ShaderInstance } from 'shaders/js'

type SeamReport = {
  poseClosed: boolean
  motionClosed: boolean
  join: number
  step: number
  wrap: number
  smooth: boolean
}

const canvas = document.querySelector('#frame') as HTMLCanvasElement
let shader: ShaderInstance | null = null
let job: ExportJob = parseExportJob({})
let sink = ''

function meanDelta(a: HTMLCanvasElement, b: HTMLCanvasElement) {
  const size = 128
  const left = document.createElement('canvas')
  const right = document.createElement('canvas')
  left.width = size
  left.height = size
  right.width = size
  right.height = size
  const leftCtx = left.getContext('2d', { willReadFrequently: true })
  const rightCtx = right.getContext('2d', { willReadFrequently: true })
  if (!leftCtx || !rightCtx) throw new Error('2D canvas unavailable')
  leftCtx.drawImage(a, 0, 0, size, size)
  rightCtx.drawImage(b, 0, 0, size, size)
  const leftPx = leftCtx.getImageData(0, 0, size, size).data
  const rightPx = rightCtx.getImageData(0, 0, size, size).data
  let sum = 0
  const pixels = size * size
  for (let index = 0; index < leftPx.length; index += 4) {
    sum += Math.abs(leftPx[index] - rightPx[index])
    sum += Math.abs(leftPx[index + 1] - rightPx[index + 1])
    sum += Math.abs(leftPx[index + 2] - rightPx[index + 2])
  }
  return sum / (pixels * 3)
}

async function exactFrame() {
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
  if (!blob) throw new Error('Frame capture failed')
  const bitmap = await createImageBitmap(blob)
  const exact = document.createElement('canvas')
  exact.width = job.size
  exact.height = job.size
  const ctx = exact.getContext('2d', { alpha: false })
  if (!ctx) throw new Error('2D canvas unavailable')
  ctx.drawImage(bitmap, 0, 0, job.size, job.size)
  bitmap.close()
  return exact
}

async function show(loopPhase: number) {
  if (!shader) throw new Error('Renderer is not ready')
  pushScene(shader, sceneAt(job, loopPhase))
  await paintTwice()
  await paintTwice()
}

async function apply(next: unknown, frameSink: string) {
  job = parseExportJob(next)
  sink = frameSink
  document.body.style.background = groundColors[job.ground]
  shader?.destroy()
  shader = null
  shader = await mountShader(canvas, sceneAt(job, job.startPhase))
  shader.resize(job.size, job.size)
  await paintTwice()
  if (canvas.width < job.size * 0.98 || canvas.height < job.size * 0.98) {
    throw new Error(`Buffer is ${canvas.width}×${canvas.height}. Need ${job.size}.`)
  }
  await show(job.startPhase)
}

async function renderFrame(index: number) {
  const count = frameCount(job.seconds, job.fps)
  if (!Number.isInteger(index) || index < 0 || index >= count) {
    throw new Error(`Frame ${index} is outside 0..${count - 1}`)
  }
  await show(frameLoopPhase(index, count, job.startPhase))
  const exact = await exactFrame()
  const blob = await new Promise<Blob | null>((resolve) => exact.toBlob(resolve, 'image/png'))
  if (!blob) throw new Error('Frame capture failed')
  const response = await fetch(sink, {
    method: 'POST',
    headers: { 'x-frame': String(index) },
    body: blob,
  })
  if (!response.ok) throw new Error(`Could not store frame ${index}`)
}

async function measureSeam(): Promise<SeamReport> {
  const count = frameCount(job.seconds, job.fps)
  const start = job.startPhase
  const pose = seamPose(start, count, job, exportLook.knobs)
  const take = async (loopPhase: number) => {
    await show(loopPhase)
    return exactFrame()
  }
  const frame0 = await take(frameLoopPhase(0, count, start))
  const frame1 = await take(frameLoopPhase(1, count, start))
  const frameLast = await take(frameLoopPhase(count - 1, count, start))
  const frameNext = await take(start + 1)
  const join = meanDelta(frameNext, frame0)
  const step = meanDelta(frame1, frame0)
  const wrap = meanDelta(frame0, frameLast)
  const smooth = pose.poseClosed && pose.motionClosed && join < 2 && wrap < Math.max(4, step * 2.5)
  await show(frameLoopPhase(0, count, start))
  return { ...pose, join, step, wrap, smooth }
}

window.__nolume = {
  ready: true,
  apply,
  renderFrame,
  measureSeam,
}

declare global {
  interface Window {
    __nolume: {
      ready: boolean
      apply(job: unknown, frameSink: string): Promise<void>
      renderFrame(index: number): Promise<void>
      measureSeam(): Promise<SeamReport>
    }
  }
}
