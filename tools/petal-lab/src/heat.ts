import './style.css'
import { createShader, type ComponentConfig } from 'shaders/js'
import { paletteById } from './palettes'

const ground = '#0b1d3a'

const palette = paletteById('flare')
const count = 4
const ring = 0.22
const overlap = 0.82
const tilt = 0.5
const arrangement = -6
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
      <h1>Heat</h1>
      <p class="lede">Four lobes tumbling on the ring. Heat spills past the edge.</p>
      <div class="views">
        <a href="/">Bloom</a>
      </div>
    </div>
  </header>
  <main class="stage">
    <canvas id="petal"></canvas>
  </main>
  <p class="status" id="status">Compiling…</p>
`

const canvas = document.querySelector('#petal') as HTMLCanvasElement
const statusEl = document.querySelector('#status') as HTMLElement

const components: ComponentConfig[] = [
  { id: 'ground', type: 'SolidColor', props: { color: ground } },
]

const lobes: {
  id: string
  /** Tangent of the ring, in degrees. Top is 0, the right side is 90, the bottom is 180. */
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

for (let index = 0; index < count; index += 1) {
  const turn = (index / count) * Math.PI * 2 + (arrangement * Math.PI) / 180
  const dx = Math.cos(turn)
  const dy = Math.sin(turn) * squeeze
  const near = (Math.sin(turn) + 1) / 2
  const shape = {
    type: 'ellipsoid3D',
    radiusX: width,
    radiusY: length,
    radiusZ: thick,
    rotX: 36 + near * 6,
    rotY: 0,
    rotZ: 0,
  }
  const axis = (Math.atan2(dy, dx) * 180) / Math.PI + 90
  lobes.push({ id: `heat-${index}`, axis, shape })
  const center = { x: 0.5 + dx * ring, y: 0.48 + dy * ring }
  const scale = 0.94 + near * 0.12
  components.push({
    id: `heat-${index}`,
    type: 'Heatmap',
    props: {
      center,
      scale,
      rotation: (Math.atan2(dy, dx) * 180) / Math.PI + 90,
      colorA: palette.stops[0].color,
      colorB: palette.stops[palette.stops.length - 1].color,
      stops: palette.stops,
      colorSpace: 'oklch',
      innerGlow: 0.5,
      outerGlow: 0.32,
      contour: 0.1,
      angle: 96,
      speed: 0.55,
      shape,
    },
  })
}

let ready = false
let failure: string | null = null
const shader = await createShader(canvas, { components }, {
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
statusEl.textContent = failure ?? shader.getFailureReason() ?? 'Each lobe tumbles around the ring. Heat spills past the edge.'

function tumble(now: number) {
  const t = now / 1000
  for (const lobe of lobes) {
    lobe.shape.rotX = 20 + Math.sin(t * 0.7) * 38
    lobe.shape.rotY = 0
    lobe.shape.rotZ = 0
    shader.update(lobe.id, { shape: lobe.shape, rotation: lobe.axis })
  }
  requestAnimationFrame(tumble)
}

if (!failure && !shader.getFailureReason()) requestAnimationFrame(tumble)
