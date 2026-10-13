import './style.css'
import { createShader, type ComponentConfig, type ShaderInstance } from 'shaders/js'
import { bloomDefaults } from './approaches'
import { defaultPaletteId, paletteById, palettes, type Palette } from './palettes'

const ground = '#0b1d3a'
const { count, overlap, radial: ring, arrangement, tilt } = bloomDefaults
const squeeze = 1 - tilt * 0.48
const chord = 2 * ring * Math.sin(Math.PI / count)
const length = ring * (0.62 + overlap * 0.12)
const width = Math.min((chord / 2) * (1.2 + overlap * 0.55), length * 0.72)
const thick = length * 0.4

document.body.classList.add('heat')

const app = document.querySelector('#app')
if (!app) throw new Error('Missing #app')

app.innerHTML = `
  <header class="top">
    <div>
      <p class="kicker">Shaders library</p>
      <h1>Heatmap bloom</h1>
      <p class="lede">Same ring as the bloom. Heat moves inside the shader, from the center outward.</p>
      <div class="views">
        <a href="/">Bloom</a>
      </div>
    </div>
  </header>
  <main class="stage">
    <canvas id="petal"></canvas>
    <div>
      <div class="palettes" id="palettes"></div>
    </div>
  </main>
  <p class="status" id="status">Compiling…</p>
`

const canvas = document.querySelector('#petal') as HTMLCanvasElement
const paletteRow = document.querySelector('#palettes') as HTMLElement
const statusEl = document.querySelector('#status') as HTMLElement

let paletteId = defaultPaletteId
let shader: ShaderInstance | null = null

const lobes: {
  id: string
  axis: number
  shape: {
    type: string
    radiusX: number
    radiusY: number
    radiusZ: number
    rotX: number
    rotY: number
    rotZ: number
  }
}[] = []

function heatmap(id: string, palette: Palette, center: { x: number; y: number }, scale: number, shape: (typeof lobes)[number]['shape'], axis: number): ComponentConfig {
  return {
    id,
    type: 'Heatmap',
    props: {
      center,
      scale,
      rotation: axis,
      colorA: palette.stops[0].color,
      colorB: palette.stops[palette.stops.length - 1].color,
      stops: palette.stops,
      colorSpace: 'oklch',
      innerGlow: 0.5,
      outerGlow: 0,
      contour: 0.1,
      angle: 90,
      speed: 0.35,
      shape,
    },
  }
}

const components: ComponentConfig[] = [
  { id: 'ground', type: 'SolidColor', props: { color: ground } },
]

for (let index = 0; index < count; index += 1) {
  const turn = (index / count) * Math.PI * 2 + (arrangement * Math.PI) / 180
  const dx = Math.cos(turn)
  const dy = Math.sin(turn) * squeeze
  const near = (Math.sin(turn) + 1) / 2
  const axis = (Math.atan2(dy, dx) * 180) / Math.PI + 90
  const shape = {
    type: 'ellipsoid3D',
    radiusX: width,
    radiusY: length,
    radiusZ: thick,
    rotX: 20,
    rotY: 0,
    rotZ: 0,
  }
  const id = `heat-${index}`
  lobes.push({ id, axis, shape })
  components.push(heatmap(id, paletteById(paletteId), { x: 0.5 + dx * ring, y: 0.48 + dy * ring }, 0.94 + near * 0.12, shape, axis))
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
      for (const lobe of lobes) {
        shader?.update(lobe.id, {
          stops: palette.stops,
          colorA: palette.stops[0].color,
          colorB: palette.stops[palette.stops.length - 1].color,
        })
      }
      statusEl.textContent = palette.name
    })
    paletteRow.append(button)
  }
}

paintPalettes()

let ready = false
let failure: string | null = null
shader = await createShader(canvas, { components }, {
  disableTelemetry: true,
  onReady: () => {
    ready = true
  },
  onError: (reason) => {
    failure = reason
  },
})
const started = performance.now()
while (!ready && !failure && !shader.getFailureReason() && performance.now() - started < 20000) {
  await new Promise((resolve) => requestAnimationFrame(() => resolve(null)))
}
statusEl.textContent = failure ?? shader.getFailureReason() ?? paletteById(paletteId).name

function tumble(now: number) {
  const tilt = 20 + Math.sin(now / 1000 * 0.45) * 32
  for (const lobe of lobes) {
    lobe.shape.rotX = tilt
    lobe.shape.rotY = 0
    lobe.shape.rotZ = 0
    shader?.update(lobe.id, { shape: lobe.shape, rotation: lobe.axis })
  }
  requestAnimationFrame(tumble)
}

if (!failure && !shader.getFailureReason()) requestAnimationFrame(tumble)
