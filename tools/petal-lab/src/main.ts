import './style.css'
import { createShader, type ComponentConfig, type ShaderInstance } from 'shaders/js'
import {
  bloomDefaults,
  marks,
  markScene,
  masterScene,
  materialDefaults,
  surfaceNote,
  surfaces,
  type BloomKnobs,
  type MarkId,
  type MaterialKnobs,
  type Surface,
} from './approaches'
import { defaultPaletteId, paletteById, palettes, type Palette } from './palettes'

type View = 'master' | 'bloom' | 'lab'

let view: View = 'bloom'
let mark: MarkId = 'bloom'
let surface: Surface = 'plastic'
let knobs: MaterialKnobs = { ...materialDefaults }
let bloom: BloomKnobs = { ...bloomDefaults }
let paletteId = defaultPaletteId
let drift = 0
let tumble = 20
let shader: ShaderInstance | null = null
let mountedKey = ''
let generation = 0

const app = document.querySelector('#app')
if (!app) throw new Error('Missing #app')

app.innerHTML = `
  <header class="top">
    <div>
      <p class="kicker">Shaders library</p>
      <h1 id="title">Bloom composition</h1>
      <p class="lede" id="lede">Each petal keeps a full ramp, shifted a little around the ring.</p>
      <div class="views">
        <button type="button" id="view-master">Master Petal</button>
        <button type="button" id="view-bloom" aria-pressed="true">Bloom Composition</button>
        <button type="button" id="view-lab">Material Lab</button>
        <a href="/heat.html">Heat</a>
        <a href="/flow.html">Heatmap bloom</a>
        <a href="/export.html">Export</a>
      </div>
      <div class="marks" id="marks"></div>
    </div>
    <div class="actions">
      <button type="button" id="export-png">PNG 1024</button>
      <button type="button" id="reset">Reset</button>
    </div>
  </header>
  <main class="stage">
    <canvas id="petal"></canvas>
    <div>
      <div class="palettes" id="palettes"></div>
      <p class="section-label">Material</p>
      <div class="materials" id="materials"></div>
      <div class="controls" id="controls"></div>
      <div id="composition"></div>
    </div>
  </main>
  <p class="status" id="status">Compiling the bloom…</p>
`

const canvas = document.querySelector('#petal') as HTMLCanvasElement
const materials = document.querySelector('#materials') as HTMLElement
const controls = document.querySelector('#controls') as HTMLElement
const composition = document.querySelector('#composition') as HTMLElement
const paletteRow = document.querySelector('#palettes') as HTMLElement
const statusEl = document.querySelector('#status') as HTMLElement
const titleEl = document.querySelector('#title') as HTMLElement
const ledeEl = document.querySelector('#lede') as HTMLElement
const marksRow = document.querySelector('#marks') as HTMLElement

const materialSpecs: { key: keyof MaterialKnobs; label: string; min: number; max: number; step: number }[] = [
  { key: 'lightAngle', label: 'Light angle', min: 0, max: 360, step: 1 },
  { key: 'gradientAngle', label: 'Gradient angle', min: 0, max: 360, step: 1 },
  { key: 'curvature', label: 'Color bend', min: 0, max: 1, step: 0.01 },
  { key: 'waveScale', label: 'Bend scale', min: 0.5, max: 2.4, step: 0.05 },
  { key: 'roughness', label: 'Roughness', min: 0.05, max: 0.9, step: 0.01 },
  { key: 'reflectivity', label: 'Reflectivity', min: 0, max: 1.4, step: 0.01 },
  { key: 'thickness', label: 'Inflation', min: 0.2, max: 1, step: 0.01 },
  { key: 'shading', label: 'Shading', min: 0, max: 1, step: 0.01 },
  { key: 'rim', label: 'Rim light', min: 0, max: 1, step: 0.01 },
  { key: 'effect', label: 'Effect strength', min: 0, max: 1, step: 0.01 },
]

const bloomSpecs: { key: keyof BloomKnobs; label: string; min: number; max: number; step: number }[] = [
  { key: 'count', label: 'Petal count', min: 6, max: 20, step: 1 },
  { key: 'overlap', label: 'Petal overlap', min: 0, max: 1, step: 0.01 },
  { key: 'radial', label: 'Radial distance', min: 0.12, max: 0.34, step: 0.005 },
  { key: 'tilt', label: 'Head tilt', min: 0, max: 1, step: 0.01 },
  { key: 'arrangement', label: 'Petal rotation offset', min: -180, max: 180, step: 1 },
  { key: 'gradientOffset', label: 'Gradient scale', min: 0, max: 1, step: 0.01 },
  { key: 'fieldRotation', label: 'Field direction', min: 0, max: 360, step: 1 },
]

const motionSpecs: { key: keyof MaterialKnobs; label: string; min: number; max: number; step: number }[] = [
  { key: 'motion', label: 'Gradient motion', min: 0, max: 1, step: 0.01 },
  { key: 'driftSpeed', label: 'Gradient speed', min: 0, max: 1, step: 0.01 },
]

function materialKeys(kind: Surface): (keyof MaterialKnobs)[] {
  if (kind === 'heatmap') return ['gradientAngle', 'curvature', 'waveScale', 'shading', 'effect']
  if (kind === 'chrome') return ['lightAngle', 'roughness', 'curvature', 'rim', 'effect']
  if (kind === 'holo') return ['gradientAngle', 'curvature', 'waveScale', 'roughness', 'effect']
  if (kind === 'glass' || kind === 'crystal') return ['lightAngle', 'roughness', 'reflectivity', 'thickness', 'rim', 'effect']
  if (kind === 'liquid') return ['curvature', 'waveScale', 'roughness', 'effect']
  if (kind === 'emboss') return ['lightAngle', 'reflectivity', 'shading', 'effect']
  if (kind === 'irradiance') return ['shading', 'effect']
  if (kind === 'goo') return ['lightAngle', 'thickness', 'reflectivity', 'shading', 'rim']
  if (kind === 'film') return ['lightAngle', 'gradientAngle', 'curvature', 'waveScale', 'roughness', 'reflectivity', 'thickness', 'shading', 'rim', 'effect']
  return ['lightAngle', 'gradientAngle', 'curvature', 'waveScale', 'roughness', 'reflectivity', 'thickness', 'shading', 'rim']
}

function structureKey() {
  const count = view === 'bloom' && mark === 'bloom' ? Math.round(bloom.count) : 'one'
  const which = view === 'bloom' ? mark : 'solo'
  return `${view}:${surface}:${which}:${count}`
}

function currentScene(): ComponentConfig[] {
  const palette = paletteById(paletteId)
  if (view === 'bloom') return markScene(mark, knobs, palette, bloom, drift, surface, tumble)
  return masterScene(knobs, palette, drift, surface, bloom.repeat)
}

function readNumber(value: number, step: number) {
  return step >= 1 ? String(Math.round(value)) : value.toFixed(2)
}

function applyLive() {
  if (!shader || mountedKey !== structureKey()) {
    void show()
    return
  }
  const visit = (component: ComponentConfig) => {
    if (component.id && component.props) shader?.update(component.id, component.props)
    component.children?.forEach(visit)
  }
  currentScene().forEach(visit)
}

function paintHeading() {
  const titles = { master: 'Master petal', bloom: 'Bloom composition', lab: 'Material lab' }
  const current = marks.find((item) => item.id === mark) ?? marks[0]
  titleEl.textContent = titles[view]
  ledeEl.textContent = view === 'bloom' ? current.lede : 'One lobe under the same sliding sheet.'
  document.querySelector('#view-master')?.setAttribute('aria-pressed', view === 'master' ? 'true' : 'false')
  document.querySelector('#view-bloom')?.setAttribute('aria-pressed', view === 'bloom' ? 'true' : 'false')
  document.querySelector('#view-lab')?.setAttribute('aria-pressed', view === 'lab' ? 'true' : 'false')
  composition.hidden = view !== 'bloom'
  paintMarks()
}

function paintMarks() {
  marksRow.hidden = view !== 'bloom'
  marksRow.replaceChildren()
  for (const item of marks) {
    const button = document.createElement('button')
    button.type = 'button'
    button.textContent = item.label
    button.setAttribute('aria-pressed', mark === item.id ? 'true' : 'false')
    button.addEventListener('click', () => setMark(item.id))
    marksRow.append(button)
  }
}

function setMark(next: MarkId) {
  if (mark === next) return
  mark = next
  paintHeading()
  paintComposition()
  void show()
}

function paintPalettes() {
  paletteRow.replaceChildren()
  for (const palette of palettes) {
    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'palette'
    button.setAttribute('aria-pressed', palette.id === paletteId ? 'true' : 'false')
    const swatch = document.createElement('span')
    swatch.className = 'swatch'
    for (const color of palette.swatch) {
      const chip = document.createElement('i')
      chip.style.background = color
      swatch.append(chip)
    }
    const name = document.createElement('span')
    name.textContent = palette.name
    button.append(swatch, name)
    button.addEventListener('click', () => {
      paletteId = palette.id
      paintPalettes()
      applyLive()
      statusEl.textContent = palette.name
    })
    paletteRow.append(button)
  }
}

function slider(
  labelText: string,
  value: number,
  min: number,
  max: number,
  step: number,
  onInput: (value: number) => void,
) {
  const label = document.createElement('label')
  const name = document.createElement('span')
  name.textContent = labelText
  const readout = document.createElement('span')
  const input = document.createElement('input')
  input.type = 'range'
  input.min = String(min)
  input.max = String(max)
  input.step = String(step)
  input.value = String(value)
  const write = () => {
    readout.textContent = readNumber(Number(input.value), step)
  }
  input.addEventListener('input', () => {
    onInput(Number(input.value))
    write()
    applyLive()
  })
  write()
  label.append(name, readout, input)
  return label
}

function paintMaterials() {
  materials.replaceChildren()
  for (const item of surfaces) {
    const button = document.createElement('button')
    button.type = 'button'
    button.textContent = item.label
    button.setAttribute('aria-pressed', surface === item.id ? 'true' : 'false')
    button.addEventListener('click', () => {
      if (surface === item.id && !(view === 'bloom' && !item.onBloom)) return
      surface = item.id
      if (view === 'bloom' && !item.onBloom) {
        view = 'lab'
        paintHeading()
      }
      paintMaterials()
      paintControls()
      applyLive()
      statusEl.textContent = surfaceNote(item.id)
    })
    materials.append(button)
  }
}

function paintControls() {
  controls.replaceChildren()
  const allowed = new Set(materialKeys(surface))
  for (const spec of materialSpecs) {
    if (!allowed.has(spec.key)) continue
    controls.append(slider(spec.label, knobs[spec.key], spec.min, spec.max, spec.step, (value) => {
      knobs[spec.key] = value
    }))
  }
  for (const spec of motionSpecs) {
    controls.append(slider(spec.label, knobs[spec.key], spec.min, spec.max, spec.step, (value) => {
      knobs[spec.key] = value
    }))
  }
}

function paintComposition() {
  composition.replaceChildren()
  const heading = document.createElement('p')
  heading.className = 'section-label'
  heading.textContent = 'Composition'
  const compare = document.createElement('div')
  compare.className = 'compare'
  for (const mode of [
    { repeat: 'mirror' as const, label: 'Mirrored' },
    { repeat: 'straight' as const, label: 'Straight' },
  ]) {
    const button = document.createElement('button')
    button.type = 'button'
    button.textContent = mode.label
    button.setAttribute('aria-pressed', bloom.repeat === mode.repeat ? 'true' : 'false')
    button.addEventListener('click', () => {
      bloom.repeat = mode.repeat
      paintComposition()
      applyLive()
      statusEl.textContent = mode.repeat === 'mirror'
        ? 'Mirrored. The sheet runs out and back, so the repeat has no hard restart.'
        : 'Straight. The sheet restarts the palette at each cycle.'
    })
    compare.append(button)
  }
  composition.append(heading, compare)
  const ringOnly = new Set<keyof BloomKnobs>(['count', 'overlap', 'radial', 'tilt', 'arrangement'])
  for (const spec of bloomSpecs) {
    if (mark !== 'bloom' && ringOnly.has(spec.key)) continue
    const value = bloom[spec.key]
    if (typeof value !== 'number') continue
    composition.append(slider(spec.label, value, spec.min, spec.max, spec.step, (next) => {
      bloom[spec.key] = next as never
    }))
  }
}

async function mount(target: HTMLCanvasElement, components: ComponentConfig[]) {
  let ready = false
  let failure: string | null = null
  const instance = await createShader(target, { components }, {
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

async function show() {
  const token = ++generation
  const key = structureKey()
  const components = currentScene()
  const previous = shader
  shader = null
  mountedKey = ''
  previous?.destroy()
    const current = marks.find((item) => item.id === mark)
    statusEl.textContent = view === 'master' ? 'Compiling the petal…' : `Compiling ${current?.label ?? 'the bloom'}…`
  try {
    const instance = await mount(canvas, components)
    if (token !== generation) {
      instance.destroy()
      return
    }
    shader = instance
    mountedKey = key
    document.body.dataset.ready = 'true'
    const wrap = bloom.repeat === 'mirror' ? 'Mirrored sheet.' : 'Straight sheet.'
    const where = view === 'bloom' ? `${marks.find((item) => item.id === mark)?.label ?? 'Home'}. ${wrap}` : 'Single lobe.'
    statusEl.textContent = `${where} ${surfaceNote(surface)}`
  } catch (error: unknown) {
    if (token !== generation) return
    statusEl.textContent = error instanceof Error ? error.message : 'Shader failed'
    document.body.dataset.ready = 'true'
  }
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

async function render1024(components: ComponentConfig[]): Promise<HTMLCanvasElement> {
  const gpu = document.createElement('canvas')
  gpu.style.cssText = 'position:fixed;left:0;top:0;width:1024px;height:1024px;z-index:-1;pointer-events:none;'
  document.body.appendChild(gpu)
  let instance: ShaderInstance | null = null
  try {
    instance = await mount(gpu, components)
    instance.resize(1024, 1024)
    for (let frame = 0; frame < 40 && (gpu.width < 1024 || gpu.height < 1024); frame += 1) {
      await new Promise((resolve) => requestAnimationFrame(() => resolve(null)))
    }
    instance.pause()
    const blob = await new Promise<Blob | null>((resolve) => gpu.toBlob(resolve, 'image/png'))
    if (!blob) throw new Error('PNG export failed')
    const bitmap = await createImageBitmap(blob)
    if (bitmap.width < 1024 || bitmap.height < 1024) {
      const size = `${bitmap.width}×${bitmap.height}`
      bitmap.close()
      throw new Error(`Buffer is ${size}. The library will not draw larger than the window (${window.innerWidth}×${window.innerHeight}).`)
    }
    const out = document.createElement('canvas')
    out.width = 1024
    out.height = 1024
    const ctx = out.getContext('2d')
    if (!ctx) throw new Error('2D canvas unavailable')
    ctx.drawImage(bitmap, 0, 0, 1024, 1024)
    bitmap.close()
    return out
  } finally {
    instance?.destroy()
    gpu.remove()
  }
}

function setView(next: View) {
  if (view === next) return
  view = next
  paintHeading()
  void show()
}

paintHeading()
paintPalettes()
paintMaterials()
paintControls()
paintComposition()

document.querySelector('#view-master')?.addEventListener('click', () => setView('master'))
document.querySelector('#view-bloom')?.addEventListener('click', () => setView('bloom'))
document.querySelector('#view-lab')?.addEventListener('click', () => setView('lab'))

document.querySelector('#reset')?.addEventListener('click', () => {
  knobs = { ...materialDefaults }
  bloom = { ...bloomDefaults }
  paletteId = defaultPaletteId
  surface = 'plastic'
  mark = 'bloom'
  drift = 0
  paintHeading()
  paintPalettes()
  paintMaterials()
  paintControls()
  paintComposition()
  applyLive()
})

document.querySelector('#export-png')?.addEventListener('click', () => {
  const name = view === 'master' ? 'master-petal.png' : `${mark}.png`
  statusEl.textContent = 'Rendering 1024…'
  void render1024(currentScene())
    .then((rendered) => {
      rendered.toBlob((blob) => {
        if (!blob) return
        downloadBlob(blob, name)
        statusEl.textContent = `${name} · ${rendered.width}×${rendered.height} · ${paletteById(paletteId).name}`
      }, 'image/png')
    })
    .catch((error: unknown) => {
      statusEl.textContent = error instanceof Error ? error.message : 'Export failed'
    })
})

async function blobToBase64(blob: Blob) {
  const bytes = new Uint8Array(await blob.arrayBuffer())
  let binary = ''
  const chunk = 0x8000
  for (let index = 0; index < bytes.length; index += chunk) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunk))
  }
  return btoa(binary)
}

async function pngFile(name: string, components: ComponentConfig[]) {
  const rendered = await render1024(components)
  const blob = await new Promise<Blob>((resolve, reject) => {
    rendered.toBlob((value) => (value ? resolve(value) : reject(new Error(name))), 'image/png')
  })
  return { name, base64: await blobToBase64(blob) }
}

window.__petalLab = {
  exportPack: async () => {
    const files = []
    for (const palette of palettes) {
      files.push(await pngFile(`${palette.id}-petal.png`, masterScene(materialDefaults, palette)))
    }
    files.push(await pngFile('master-petal.png', masterScene(materialDefaults, paletteById(defaultPaletteId))))
    files.push(await pngFile('bloom-composition.png', markScene('bloom', materialDefaults, paletteById(defaultPaletteId), bloomDefaults)))
    return files
  },
}

declare global {
  interface Window {
    __petalLab?: {
      exportPack: () => Promise<{ name: string; base64: string }[]>
    }
  }
}

function applyFrame() {
  if (!shader || mountedKey !== structureKey()) return
  const visit = (component: ComponentConfig) => {
    const props = component.props
    if (component.id && props) {
      const patch: Record<string, unknown> = {}
      if ('stops' in props && props.stops) {
        patch.stops = props.stops
        patch.colorA = props.colorA
        patch.colorB = props.colorB
      }
      if ('start' in props && props.start) patch.start = props.start
      if ('end' in props && props.end) patch.end = props.end
      if (view === 'bloom' && 'shape' in props && props.shape) {
        patch.shape = props.shape
        patch.rotation = props.rotation
      }
      if (Object.keys(patch).length > 0) shader?.update(component.id, patch)
    }
    component.children?.forEach(visit)
  }
  currentScene().forEach(visit)
}

function tick(now: number) {
  const t = now / 1000
  tumble = 20 + Math.sin(t * 0.42) * 38
  const glide = Math.sin(t * knobs.driftSpeed * 0.85) * knobs.motion * 0.5
  const driftMoved = glide !== drift
  drift = glide
  if (shader && mountedKey === structureKey() && (view === 'bloom' || driftMoved)) applyFrame()
  requestAnimationFrame(tick)
}

requestAnimationFrame(tick)
void show()
