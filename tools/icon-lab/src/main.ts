import './style.css'
import JSZip from 'jszip'
import { cloneParams, conceptById, concepts } from './concepts'
import { buildPack } from './pack'
import { canvasHasInk, MarkView, renderIcon } from './studio'
import { geometrySvg } from './svg'
import type { PackFile, Params, RenderMode, SliderSpec } from './types'

declare global {
  interface Window {
    __nolumeIconLab?: {
      exportPack: () => Promise<PackFile[]>
    }
  }
}

const backgrounds = [
  { name: 'Plum', value: '#1a1222' },
  { name: 'Navy', value: '#101820' },
  { name: 'Ink', value: '#12141a' },
  { name: 'Paper', value: '#f3eee6' },
  { name: 'Sand', value: '#f6f1e7' },
  { name: 'Blush', value: '#f6e4de' },
]

const paramsById = new Map<string, Params>(concepts.map((concept) => [concept.id, cloneParams(concept.defaults)]))
const skipShaders = new URLSearchParams(location.search).has('export')

let selectedId = concepts.some((concept) => concept.id === location.hash.slice(1))
  ? location.hash.slice(1)
  : concepts[0].id
let mode: RenderMode = 'shader'
let drift = false
let exporting = false

const app = document.querySelector('#app')
if (!app) throw new Error('Missing #app')

app.innerHTML = `
  <header class="top">
    <div>
      <p class="kicker">Icon lab</p>
      <h1 class="word">Nolume</h1>
      <p class="lede">Six abstract marks. The live view is a WebGPU material. SVG export is the shape layout, not the shaded icon.</p>
    </div>
    <div class="actions">
      <button type="button" id="export-png">PNG 1024</button>
      <button type="button" id="export-zip">ZIP</button>
      <button type="button" id="export-sheet">Contact sheet</button>
      <button type="button" id="export-svg">SVG geometry</button>
    </div>
  </header>
  <main class="workspace">
    <section class="gallery" id="gallery"></section>
    <section class="stage-wrap">
      <div class="stack stage-frame" id="stage"></div>
      <div class="sizes" id="sizes"></div>
      <p class="summary" id="summary"></p>
    </section>
    <aside class="controls" id="controls"></aside>
  </main>
`

const gallery = document.querySelector('#gallery') as HTMLElement
const stageFrame = document.querySelector('#stage') as HTMLElement
const sizes = document.querySelector('#sizes') as HTMLElement
const summary = document.querySelector('#summary') as HTMLElement
const controls = document.querySelector('#controls') as HTMLElement

const galleryViews = new Map<string, MarkView>()

function makeStack(className: string): { frame: HTMLElement; view: MarkView } {
  const frame = document.createElement('div')
  frame.className = `stack ${className}`
  const cpu = document.createElement('canvas')
  const gpu = document.createElement('canvas')
  cpu.className = 'cpu'
  gpu.className = 'gpu'
  frame.append(cpu, gpu)
  return { frame, view: new MarkView(frame, gpu, cpu) }
}

for (const concept of concepts) {
  const button = document.createElement('button')
  button.type = 'button'
  button.className = 'card'
  button.dataset.id = concept.id
  const { frame, view } = makeStack('thumb')
  const name = document.createElement('span')
  name.className = 'card-name'
  name.innerHTML = `<b>${concept.letter}</b> ${concept.name}`
  button.append(frame, name)
  button.addEventListener('click', () => select(concept.id))
  gallery.append(button)
  galleryViews.set(concept.id, view)
}

const stageBits = makeStack('stage-frame')
stageFrame.replaceWith(stageBits.frame)
stageBits.frame.id = 'stage'
const stage = stageBits.view

for (const px of [32, 48, 80, 128]) {
  const figure = document.createElement('figure')
  const img = document.createElement('img')
  img.width = px
  img.height = px
  img.alt = `${px} pixel preview`
  const caption = document.createElement('figcaption')
  caption.textContent = String(px)
  figure.append(img, caption)
  sizes.append(figure)
}

const status = document.createElement('p')
status.className = 'status'
status.textContent = 'Painting geometry…'

function currentConcept() {
  return conceptById(selectedId)
}

function currentParams(): Params {
  return paramsById.get(selectedId) ?? currentConcept().defaults
}

function setPressed() {
  for (const card of gallery.querySelectorAll<HTMLButtonElement>('.card')) {
    card.setAttribute('aria-pressed', card.dataset.id === selectedId ? 'true' : 'false')
  }
}

function formatValue(spec: SliderSpec, value: number): string {
  if (spec.step >= 1) return String(Math.round(value))
  return value.toFixed(spec.step < 0.01 ? 3 : 2)
}

function renderControls() {
  const concept = currentConcept()
  const params = currentParams()
  controls.replaceChildren()

  const title = document.createElement('h2')
  title.textContent = concept.name

  const modeRow = document.createElement('div')
  modeRow.className = 'mode'
  for (const option of ['shader', 'paint'] as const) {
    const button = document.createElement('button')
    button.type = 'button'
    button.textContent = option === 'shader' ? 'Shader' : 'Painted'
    button.setAttribute('aria-pressed', mode === option ? 'true' : 'false')
    button.addEventListener('click', () => {
      mode = option
      renderControls()
      void refreshAll()
    })
    modeRow.append(button)
  }

  const driftButton = document.createElement('button')
  driftButton.type = 'button'
  driftButton.textContent = 'Drift light'
  driftButton.setAttribute('aria-pressed', drift ? 'true' : 'false')
  driftButton.addEventListener('click', () => {
    drift = !drift
    driftButton.setAttribute('aria-pressed', drift ? 'true' : 'false')
    status.textContent = drift
      ? 'Light is drifting in the preview. PNG export uses the light slider, not the moving frame.'
      : status.textContent
  })
  modeRow.append(driftButton)

  controls.append(title, modeRow, fieldGroup('Palette', paletteFields(params)), fieldGroup('Ground', groundFields(params)))
  controls.append(fieldGroup('Form', concept.sliders.filter((spec) => isForm(spec.key)).map((spec) => slider(spec, params))))
  controls.append(fieldGroup('Material', concept.sliders.filter((spec) => !isForm(spec.key)).map((spec) => slider(spec, params))))

  const reset = document.createElement('button')
  reset.type = 'button'
  reset.className = 'reset'
  reset.textContent = 'Reset this design'
  reset.addEventListener('click', () => {
    paramsById.set(concept.id, cloneParams(concept.defaults))
    renderControls()
    void refreshOne(concept.id)
  })
  controls.append(reset, status)
}

function isForm(key: string): boolean {
  return key === 'count' || key === 'spacing' || key === 'scale' || key === 'rotation'
}

function fieldGroup(label: string, children: HTMLElement[]): HTMLElement {
  const group = document.createElement('div')
  group.className = 'group'
  const heading = document.createElement('h3')
  heading.textContent = label
  group.append(heading, ...children)
  return group
}

function paletteFields(params: Params): HTMLElement[] {
  const row = document.createElement('div')
  row.className = 'swatches'
  params.colors.forEach((color, index) => {
    const label = document.createElement('label')
    const input = document.createElement('input')
    input.type = 'color'
    input.value = color
    input.addEventListener('input', () => {
      params.colors[index] = input.value
      void refreshOne(selectedId)
    })
    label.append(input)
    row.append(label)
  })
  return [row]
}

function groundFields(params: Params): HTMLElement[] {
  const row = document.createElement('div')
  row.className = 'bg-row'
  const input = document.createElement('input')
  input.type = 'color'
  input.value = params.background
  input.addEventListener('input', () => {
    params.background = input.value
    void refreshOne(selectedId)
  })
  row.append(input)

  const presets = document.createElement('div')
  presets.className = 'presets'
  for (const preset of backgrounds) {
    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'preset'
    button.textContent = preset.name
    button.addEventListener('click', () => {
      params.background = preset.value
      input.value = preset.value
      void refreshOne(selectedId)
    })
    presets.append(button)
  }
  return [row, presets]
}

function slider(spec: SliderSpec, params: Params): HTMLElement {
  const field = document.createElement('label')
  field.className = 'field'
  const name = document.createElement('span')
  name.textContent = spec.label
  const readout = document.createElement('span')
  readout.dataset.readout = spec.key
  const input = document.createElement('input')
  input.type = 'range'
  input.min = String(spec.min)
  input.max = String(spec.max)
  input.step = String(spec.step)
  input.value = String(params[spec.key])
  const write = () => {
    readout.textContent = formatValue(spec, Number(input.value))
  }
  input.addEventListener('input', () => {
    params[spec.key] = Number(input.value)
    write()
    void refreshOne(selectedId)
  })
  write()
  field.append(name, readout, input)
  return field
}

function writeSummary() {
  const concept = currentConcept()
  summary.innerHTML = `<strong>${concept.letter}. ${concept.name}.</strong> ${concept.summary}`
}

async function refreshOne(id: string) {
  const concept = conceptById(id)
  const params = paramsById.get(id) ?? concept.defaults
  const useMode = skipShaders ? 'paint' : mode
  const jobs: Promise<void>[] = []
  const galleryView = galleryViews.get(id)
  if (galleryView) jobs.push(galleryView.show(concept, params, useMode))
  if (id === selectedId) jobs.push(stage.show(concept, params, useMode))
  const results = await Promise.allSettled(jobs)
  const failure = results.find((result) => result.status === 'rejected')
  if (failure && failure.status === 'rejected') {
    const reason = failure.reason instanceof Error ? failure.reason.message : 'shader failed'
    status.textContent = `Shader unavailable (${reason}). Showing the painted study.`
  } else if (!exporting && mode === 'shader' && !skipShaders) {
    status.textContent = 'Shader material live. Export freezes the light slider and turns environment drift off.'
  }
  if (id === selectedId) scheduleSizes()
}

async function refreshAll() {
  for (const concept of concepts) await refreshOne(concept.id)
}

function select(id: string) {
  selectedId = id
  history.replaceState(null, '', `#${id}`)
  setPressed()
  writeSummary()
  renderControls()
  void refreshOne(id)
}

let sizeTimer = 0
function scheduleSizes() {
  window.clearTimeout(sizeTimer)
  sizeTimer = window.setTimeout(captureSizes, 280)
}

function captureSizes() {
  const shaderReady = mode === 'shader' && !stage.shaderFailed && canvasHasInk(stage.gpu)
  const source = shaderReady ? stage.gpu : stage.cpu
  if (source.width < 2) return
  const snap = document.createElement('canvas')
  snap.width = 256
  snap.height = 256
  const ctx = snap.getContext('2d')
  if (!ctx) return
  ctx.drawImage(source, 0, 0, 256, 256)
  const url = snap.toDataURL('image/png')
  for (const img of sizes.querySelectorAll('img')) img.src = url
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

function base64ToBlob(base64: string, type: string): Blob {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index)
  return new Blob([bytes], { type })
}

async function withExportLock(work: () => Promise<void>) {
  if (exporting) return
  exporting = true
  for (const button of document.querySelectorAll<HTMLButtonElement>('.actions button')) button.disabled = true
  try {
    await work()
  } catch (error) {
    status.textContent = error instanceof Error ? error.message : 'Export failed'
  } finally {
    exporting = false
    for (const button of document.querySelectorAll<HTMLButtonElement>('.actions button')) button.disabled = false
  }
}

document.querySelector('#export-png')?.addEventListener('click', () => {
  void withExportLock(async () => {
    const concept = currentConcept()
    status.textContent = `Rendering ${concept.name} at 1024…`
    const rendered = await renderIcon(concept, currentParams(), mode)
    const file = await new Promise<Blob>((resolve, reject) => {
      rendered.canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('PNG failed'))), 'image/png')
    })
    downloadBlob(file, `${concept.filename}.png`)
    status.textContent = `${concept.filename}.png · ${rendered.renderer}. ${rendered.note}`
  })
})

document.querySelector('#export-svg')?.addEventListener('click', () => {
  const concept = currentConcept()
  const mark = concept.compose(currentParams())
  const svg = geometrySvg(mark, `${concept.letter}. ${concept.name}`)
  downloadBlob(new Blob([svg], { type: 'image/svg+xml' }), `${concept.filename}.geometry.svg`)
  status.textContent = 'Geometry SVG uses flat fills. The shaded icon is the PNG.'
})

document.querySelector('#export-sheet')?.addEventListener('click', () => {
  void withExportLock(async () => {
    status.textContent = 'Rendering all six icons for the contact sheet…'
    const files = await buildPack(paramsById, mode)
    const sheet = files.find((file) => file.name === 'contact-sheet.png')
    if (!sheet) throw new Error('Contact sheet missing')
    downloadBlob(base64ToBlob(sheet.base64, 'image/png'), sheet.name)
    status.textContent = 'Contact sheet downloaded. Labels sit outside the icons.'
  })
})

document.querySelector('#export-zip')?.addEventListener('click', () => {
  void withExportLock(async () => {
    status.textContent = 'Rendering all six icons…'
    const files = await buildPack(paramsById, mode)
    const zip = new JSZip()
    for (const file of files) zip.file(file.name, file.base64, { base64: true })
    const blob = await zip.generateAsync({ type: 'blob' })
    downloadBlob(blob, 'nolume-icon-studies.zip')
    status.textContent = 'ZIP includes PNGs, geometry SVGs, hybrid SVGs, the contact sheet, and RENDER.txt.'
  })
})

window.__nolumeIconLab = {
  exportPack: () => buildPack(paramsById, skipShaders ? 'shader' : mode),
}

window.addEventListener('keydown', (event) => {
  if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return
  const target = event.target
  if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) return
  const index = concepts.findIndex((concept) => concept.id === selectedId)
  const next = event.key === 'ArrowRight' ? index + 1 : index - 1
  const concept = concepts[(next + concepts.length) % concepts.length]
  select(concept.id)
})

function driftLoop(now: number) {
  if (drift) {
    const params = currentParams()
    const angle = (params.light + now / 45) % 360
    stage.setLight(angle)
    if (mode === 'paint' || stage.shaderFailed) {
      const concept = currentConcept()
      const drifted = { ...params, colors: params.colors, light: angle }
      stage.paint(concept.compose(drifted), drifted)
    }
  }
  requestAnimationFrame(driftLoop)
}

setPressed()
writeSummary()
renderControls()
void refreshAll().finally(() => {
  document.body.dataset.ready = 'true'
  scheduleSizes()
})
requestAnimationFrame(driftLoop)

window.addEventListener('resize', () => {
  for (const concept of concepts) {
    const params = paramsById.get(concept.id)
    const view = galleryViews.get(concept.id)
    if (!params || !view?.mark) continue
    view.paint(concept.compose(params), params)
  }
  if (stage.mark) stage.paint(currentConcept().compose(currentParams()), currentParams())
  scheduleSizes()
})
