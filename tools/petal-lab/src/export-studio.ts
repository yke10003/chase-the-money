import './export-studio.css'
import type { ComponentConfig } from 'shaders/js'
import type { ShaderInstance } from 'shaders/js'
import { defaultExportJob, exportLook, fileStem, groundColors, type ExportJob, type GroundMode } from './export-config'
import { mountShader, paintTwice, pushScene, sceneAt } from './export-scene'
import {
  balancedTiming,
  frameCount,
  frameLoopPhase,
  loopPresets,
  seamPose,
  type LoopTiming,
} from './loop-clock'

const app = document.querySelector('#app')
if (!app) throw new Error('Missing #app')

app.innerHTML = `
  <header class="top">
    <div>
      <p class="kicker">Export</p>
      <h1>Loop render</h1>
      <p class="lede">Sunset Neon, soft, mirrored. The poster is the first frame of the video. Render locally writes the MP4 with FFmpeg.</p>
    </div>
    <a href="/">Back to the lab</a>
  </header>
  <main class="stage">
    <canvas id="preview"></canvas>
    <div class="panel">
      <p class="preset">Sunset Neon · Soft · Mirrored · 14 petals · motion 0.30</p>
      <div class="row">
        <button type="button" id="preset-short">Short</button>
        <button type="button" id="preset-balanced" aria-pressed="true">Balanced</button>
        <button type="button" id="preset-extended">Extended</button>
      </div>
      <label>Start phase <span id="phase-read">0.000</span>
        <input id="phase" type="range" min="0" max="1" step="0.001" value="0">
      </label>
      <label>Duration (seconds)
        <input id="duration" type="number" min="15" max="240" step="1" value="60">
      </label>
      <p class="note" id="duration-note"></p>
      <div class="row">
        <label>FPS
          <select id="fps">
            <option value="24">24</option>
            <option value="30" selected>30</option>
          </select>
        </label>
        <label>Resolution
          <select id="resolution">
            <option value="768">768</option>
            <option value="1024" selected>1024</option>
            <option value="1536">1536</option>
          </select>
        </label>
      </div>
      <div class="row">
        <button type="button" id="ground-dark" aria-pressed="true">Dark</button>
        <button type="button" id="ground-light" aria-pressed="false">Light</button>
      </div>
      <label>Preview <span id="scrub-read">start frame</span>
        <input id="scrub" type="range" min="0" max="1" step="0.0001" value="0">
      </label>
      <div class="row">
        <button type="button" id="play">Play</button>
        <button type="button" id="seam">Check seam</button>
      </div>
      <div class="row">
        <button type="button" id="png">Export PNG</button>
        <button type="button" id="render">Render locally</button>
        <button type="button" id="icon">Export Icon Composer layers</button>
      </div>
      <a id="download" hidden>Download MP4</a>
      <button type="button" id="cancel" hidden>Cancel</button>
    </div>
  </main>
  <p class="status" id="status">Compiling the preview…</p>
`

const preview = document.querySelector('#preview') as HTMLCanvasElement
const phaseInput = document.querySelector('#phase') as HTMLInputElement
const phaseRead = document.querySelector('#phase-read') as HTMLElement
const durationInput = document.querySelector('#duration') as HTMLInputElement
const durationNote = document.querySelector('#duration-note') as HTMLElement
const fpsInput = document.querySelector('#fps') as HTMLSelectElement
const resolutionInput = document.querySelector('#resolution') as HTMLSelectElement
const scrubInput = document.querySelector('#scrub') as HTMLInputElement
const scrubRead = document.querySelector('#scrub-read') as HTMLElement
const statusEl = document.querySelector('#status') as HTMLElement
const playButton = document.querySelector('#play') as HTMLButtonElement
const pngButton = document.querySelector('#png') as HTMLButtonElement
const renderButton = document.querySelector('#render') as HTMLButtonElement
const iconButton = document.querySelector('#icon') as HTMLButtonElement
const downloadLink = document.querySelector('#download') as HTMLAnchorElement
const cancelButton = document.querySelector('#cancel') as HTMLButtonElement
let downloadUrl = ''
const darkButton = document.querySelector('#ground-dark') as HTMLButtonElement
const lightButton = document.querySelector('#ground-light') as HTMLButtonElement
const seamButton = document.querySelector('#seam') as HTMLButtonElement
const presetButtons = {
  short: document.querySelector('#preset-short') as HTMLButtonElement,
  balanced: document.querySelector('#preset-balanced') as HTMLButtonElement,
  extended: document.querySelector('#preset-extended') as HTMLButtonElement,
}

let ground: GroundMode = 'dark'
let renderTimer = 0
let iconTimer = 0
let timing: LoopTiming = { ...balancedTiming }
let playing = false
let playAnchor = 0
let playFrom = 0
let previewShader: ShaderInstance | null = null
let busy = false

function phase() {
  return Number(phaseInput.value)
}

function seconds() {
  return timing.seconds
}

function fps() {
  return Number(fpsInput.value)
}

function resolution() {
  return Number(resolutionInput.value)
}

function paintReadouts() {
  const frames = frameCount(timing.seconds, fps())
  phaseRead.textContent = phase().toFixed(3)
  const scrub = Number(scrubInput.value)
  scrubRead.textContent = scrub < 0.0005 ? 'start frame' : scrub.toFixed(3)
  const tumblePeriod = timing.seconds / timing.tumbleCycles
  const gradientPeriod = timing.seconds / timing.gradientCycles
  durationNote.textContent = `${timing.tumbleCycles} tumble cycles · ${timing.gradientCycles} gradient cycles · ${timing.seconds} s · ${frames} frames at ${fps()} fps. Tumble every ${tumblePeriod.toFixed(2)} s, gradient every ${gradientPeriod.toFixed(2)} s.`
  for (const preset of loopPresets) {
    const button = presetButtons[preset.id]
    const selected = preset.tumbleCycles === timing.tumbleCycles
      && preset.gradientCycles === timing.gradientCycles
    button.setAttribute('aria-pressed', selected ? 'true' : 'false')
  }
}

function currentJob(): ExportJob {
  return {
    ...defaultExportJob,
    ground,
    startPhase: phase(),
    seconds: timing.seconds,
    tumbleCycles: timing.tumbleCycles,
    gradientCycles: timing.gradientCycles,
    fps: fps(),
    size: resolution(),
  }
}

function previewPhase() {
  return phase() + Number(scrubInput.value)
}

function showPreview() {
  if (!previewShader) return
  pushScene(previewShader, sceneAt(currentJob(), previewPhase()))
  preview.style.background = groundColors[ground]
}

function pixelRatio() {
  return Math.min(window.devicePixelRatio || 1, 2)
}

function cssSize(target: number) {
  return Math.max(1, Math.round(target / pixelRatio()))
}

function paintGroundButtons() {
  darkButton.setAttribute('aria-pressed', ground === 'dark' ? 'true' : 'false')
  lightButton.setAttribute('aria-pressed', ground === 'light' ? 'true' : 'false')
}

async function remountPreview() {
  previewShader?.destroy()
  previewShader = null
  statusEl.textContent = 'Compiling the preview…'
  try {
    previewShader = await mountShader(preview, sceneAt(currentJob(), previewPhase()))
    showPreview()
    statusEl.textContent = 'Preview ready. Scrub at 0 is the poster and the first video frame.'
  } catch (error: unknown) {
    statusEl.textContent = error instanceof Error ? error.message : 'Preview failed'
  }
}

function setBusy(next: boolean) {
  busy = next
  playButton.disabled = next
  pngButton.disabled = next
  renderButton.disabled = next
  iconButton.disabled = next
  seamButton.disabled = next
  phaseInput.disabled = next
  durationInput.disabled = next
  fpsInput.disabled = next
  resolutionInput.disabled = next
  scrubInput.disabled = next
  darkButton.disabled = next
  lightButton.disabled = next
  for (const button of Object.values(presetButtons)) button.disabled = next
}

function offerDownload(blob: Blob, filename: string) {
  if (downloadUrl) URL.revokeObjectURL(downloadUrl)
  downloadUrl = URL.createObjectURL(blob)
  downloadLink.href = downloadUrl
  downloadLink.download = filename
  downloadLink.textContent = `Download ${filename}`
  downloadLink.hidden = false
}

function downloadBlob(blob: Blob, filename: string) {
  offerDownload(blob, filename)
  downloadLink.click()
}

async function openExportCanvas(target: number) {
  const css = cssSize(target)
  if (css > window.innerWidth || css > window.innerHeight) {
    throw new Error(`This size needs a window at least ${css}×${css} CSS pixels. The shader will not draw larger than the window.`)
  }
  const host = document.createElement('div')
  host.style.cssText = `position:fixed;left:0;top:0;width:${css}px;height:${css}px;z-index:-1;pointer-events:none;`
  const canvas = document.createElement('canvas')
  canvas.style.cssText = 'width:100%;height:100%;display:block;'
  host.append(canvas)
  document.body.append(host)
  const shader = await mountShader(canvas, sceneAt(currentJob(), phase()))
  shader.resize(css, css)
  await paintTwice()
  if (canvas.width < target * 0.98 || canvas.height < target * 0.98) {
    shader.destroy()
    host.remove()
    throw new Error(`Buffer is ${canvas.width}×${canvas.height}. Need at least ${target}. Widen the window and try again.`)
  }
  return { host, canvas, shader }
}

async function grab(canvas: HTMLCanvasElement, target: number) {
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
  if (!blob) throw new Error('Frame capture failed')
  const bitmap = await createImageBitmap(blob)
  const exact = document.createElement('canvas')
  exact.width = target
  exact.height = target
  const ctx = exact.getContext('2d', { alpha: false })
  if (!ctx) throw new Error('2D canvas unavailable')
  ctx.drawImage(bitmap, 0, 0, target, target)
  bitmap.close()
  return exact
}

async function exportPng() {
  const target = resolution()
  setBusy(true)
  previewShader?.pause()
  statusEl.textContent = 'Rendering the poster…'
  let opened: Awaited<ReturnType<typeof openExportCanvas>> | null = null
  try {
    opened = await openExportCanvas(target)
    const count = frameCount(seconds(), fps())
    pushScene(opened.shader, sceneAt(currentJob(), frameLoopPhase(0, count, phase())))
    await paintTwice()
    await paintTwice()
    const exact = await grab(opened.canvas, target)
    const blob = await new Promise<Blob | null>((resolve) => exact.toBlob(resolve, 'image/png'))
    if (!blob) throw new Error('PNG export failed')
    downloadBlob(blob, `${fileStem(currentJob())}.png`)
    statusEl.textContent = `Poster ${target}×${target}. Same pose as video frame 0.`
  } catch (error: unknown) {
    statusEl.textContent = error instanceof Error ? error.message : 'PNG export failed'
  } finally {
    opened?.shader.destroy()
    opened?.host.remove()
    previewShader?.resume()
    showPreview()
    setBusy(false)
  }
}


function channelGap(a: string, b: string) {
  let gap = 0
  for (let index = 0; index < 3; index += 1) {
    const left = Number.parseInt(a.slice(1 + index * 2, 3 + index * 2), 16)
    const right = Number.parseInt(b.slice(1 + index * 2, 3 + index * 2), 16)
    gap = Math.max(gap, Math.abs(left - right))
  }
  return gap
}

function fieldAt(loopPhase: number) {
  const colors: string[] = []
  const tumbles: number[] = []
  const visit = (component: ComponentConfig) => {
    const shape = component.props?.shape as { rotX?: number } | undefined
    if (shape && typeof shape.rotX === 'number') tumbles.push(shape.rotX)
    const stops = component.props?.stops as { color: string }[] | undefined
    if (stops) colors.push(...stops.map((stop) => stop.color))
    component.children?.forEach(visit)
  }
  sceneAt(currentJob(), loopPhase).forEach(visit)
  return { colors, tumbles }
}

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

async function checkSeam() {
  const count = frameCount(seconds(), fps())
  const start = phase()
  const pose = seamPose(start, count, timing, exportLook.knobs)
  const here = fieldAt(start)
  const around = fieldAt(start + 1)
  let colorGap = 0
  for (let index = 0; index < here.colors.length; index += 1) {
    colorGap = Math.max(colorGap, channelGap(here.colors[index], around.colors[index] ?? '#000000'))
  }
  let tumbleGap = 0
  for (let index = 0; index < here.tumbles.length; index += 1) {
    tumbleGap = Math.max(tumbleGap, Math.abs(here.tumbles[index] - (around.tumbles[index] ?? 0)))
  }
  if (!pose.poseClosed || !pose.motionClosed || colorGap > 1 || tumbleGap > 1e-4) {
    statusEl.textContent = `Seam failed. Pose ${pose.poseClosed ? 'closed' : 'open'}, motion ${pose.motionClosed ? 'matched' : 'reversed'}, color gap ${colorGap}, tumble gap ${tumbleGap.toExponential(2)}.`
    return
  }

  const target = 384
  setBusy(true)
  previewShader?.pause()
  statusEl.textContent = 'Checking the seam…'
  let opened: Awaited<ReturnType<typeof openExportCanvas>> | null = null
  try {
    opened = await openExportCanvas(target)
    const take = async (loopPhase: number) => {
      pushScene(opened!.shader, sceneAt(currentJob(), loopPhase))
      await paintTwice()
      await paintTwice()
      return grab(opened!.canvas, target)
    }
    const frame0 = await take(frameLoopPhase(0, count, start))
    const frame1 = await take(frameLoopPhase(1, count, start))
    const frameLast = await take(frameLoopPhase(count - 1, count, start))
    const frameNext = await take(start + 1)
    const join = meanDelta(frameNext, frame0)
    const stepDelta = meanDelta(frame1, frame0)
    const wrapDelta = meanDelta(frame0, frameLast)
    const smooth = join < 2 && wrapDelta < Math.max(4, stepDelta * 2.5)
    statusEl.textContent = smooth
      ? `Seam holds. Join ${join.toFixed(2)}, step ${stepDelta.toFixed(2)}, wrap ${wrapDelta.toFixed(2)}. ${timing.tumbleCycles} tumbles and ${timing.gradientCycles} gradient cycles in ${timing.seconds} s.`
      : `Seam is visible. Join ${join.toFixed(2)}, step ${stepDelta.toFixed(2)}, wrap ${wrapDelta.toFixed(2)}.`
  } catch (error: unknown) {
    statusEl.textContent = error instanceof Error ? error.message : 'Seam check failed'
  } finally {
    opened?.shader.destroy()
    opened?.host.remove()
    previewShader?.resume()
    showPreview()
    setBusy(false)
  }
}

function tick(now: number) {
  if (playing && !busy) {
    const elapsed = (now - playAnchor) / 1000
    const next = (playFrom + elapsed / seconds()) % 1
    scrubInput.value = String(next)
    paintReadouts()
    showPreview()
  }
  requestAnimationFrame(tick)
}

phaseInput.addEventListener('input', () => {
  scrubInput.value = '0'
  paintReadouts()
  showPreview()
})

durationInput.addEventListener('change', () => {
  const next = Number(durationInput.value)
  if (Number.isFinite(next) && next >= 15 && next <= 240) timing = { ...timing, seconds: next }
  durationInput.value = String(timing.seconds)
  paintReadouts()
  showPreview()
})

for (const preset of loopPresets) {
  presetButtons[preset.id].addEventListener('click', () => {
    timing = { ...preset }
    durationInput.value = String(preset.seconds)
    paintReadouts()
    showPreview()
  })
}

fpsInput.addEventListener('change', paintReadouts)
resolutionInput.addEventListener('change', paintReadouts)

scrubInput.addEventListener('input', () => {
  playing = false
  playButton.textContent = 'Play'
  paintReadouts()
  showPreview()
})

playButton.addEventListener('click', () => {
  playing = !playing
  playButton.textContent = playing ? 'Pause' : 'Play'
  if (playing) {
    playAnchor = performance.now()
    playFrom = Number(scrubInput.value)
  }
})

darkButton.addEventListener('click', () => {
  if (ground === 'dark') return
  ground = 'dark'
  paintGroundButtons()
  void remountPreview()
})

lightButton.addEventListener('click', () => {
  if (ground === 'light') return
  ground = 'light'
  paintGroundButtons()
  void remountPreview()
})

seamButton.addEventListener('click', () => {
  void checkSeam()
})

pngButton.addEventListener('click', () => {
  void exportPng()
})

type RenderStatus = {
  state: 'idle' | 'rendering' | 'done' | 'error'
  message: string
}

async function pollRender() {
  const response = await fetch('/local-render')
  if (!response.ok) return
  const status = await response.json() as RenderStatus
  statusEl.textContent = status.message
  if (status.state === 'rendering') return
  window.clearInterval(renderTimer)
  renderTimer = 0
  cancelButton.hidden = true
  renderButton.disabled = false
}

async function startLocalRender() {
  if (renderTimer) return
  statusEl.textContent = 'Starting the local render…'
  renderButton.disabled = true
  cancelButton.hidden = false
  const response = await fetch('/local-render', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(currentJob()),
  })
  if (!response.ok) {
    statusEl.textContent = await response.text()
    cancelButton.hidden = true
    renderButton.disabled = false
    return
  }
  renderTimer = window.setInterval(() => {
    void pollRender()
  }, 1000)
  void pollRender()
}

async function cancelLocalRender() {
  await fetch('/local-render', { method: 'DELETE' })
  await fetch('/icon-layers', { method: 'DELETE' })
  statusEl.textContent = 'Cancelling…'
}

async function pollIcon() {
  const response = await fetch('/icon-layers')
  if (!response.ok) return
  const status = await response.json() as RenderStatus
  statusEl.textContent = status.message
  if (status.state === 'rendering') return
  window.clearInterval(iconTimer)
  iconTimer = 0
  cancelButton.hidden = true
  iconButton.disabled = false
}

async function startIconLayers() {
  if (iconTimer) return
  playing = false
  playButton.textContent = 'Play'
  statusEl.textContent = 'Starting the icon layer export…'
  iconButton.disabled = true
  cancelButton.hidden = false
  const response = await fetch('/icon-layers', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      phase: previewPhase(),
      startPhase: phase(),
      scrub: Number(scrubInput.value),
      tumbleCycles: timing.tumbleCycles,
      gradientCycles: timing.gradientCycles,
    }),
  })
  if (!response.ok) {
    statusEl.textContent = await response.text()
    cancelButton.hidden = true
    iconButton.disabled = false
    return
  }
  iconTimer = window.setInterval(() => {
    void pollIcon()
  }, 1000)
  void pollIcon()
}

renderButton.addEventListener('click', () => {
  void startLocalRender()
})

iconButton.addEventListener('click', () => {
  void startIconLayers()
})

cancelButton.addEventListener('click', () => {
  void cancelLocalRender()
})

paintGroundButtons()
paintReadouts()
requestAnimationFrame(tick)
void remountPreview()
