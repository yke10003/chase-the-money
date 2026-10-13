/**
 * Export one bloom frame as transparent petal layers for Icon Composer.
 *
 *   npm run icon-layers -- --phase 0.661
 *
 * The phase is the frame on the export page (start phase plus the scrubber).
 */
import { spawn, spawnSync, type ChildProcess } from 'node:child_process'
import { existsSync, writeFileSync } from 'node:fs'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium, type Browser } from 'playwright'
import { exportLook } from '../src/export-config'
import { balancedTiming } from '../src/loop-clock'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const chromeArgs = ['--use-angle=metal', '--enable-unsafe-webgpu']

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

type Request = {
  phase: number
  startPhase: number
  scrub: number
  tumbleCycles: number
  gradientCycles: number
}

function flags() {
  const map = new Map<string, string>()
  const argv = process.argv.slice(2)
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index]
    if (!token?.startsWith('--')) continue
    const value = argv[index + 1]
    if (!value || value.startsWith('--')) map.set(token.slice(2), 'true')
    else {
      map.set(token.slice(2), value)
      index += 1
    }
  }
  return map
}

async function readRequest(argv: Map<string, string>): Promise<Request> {
  let raw: Record<string, unknown> = {}
  const configPath = argv.get('config')
  if (configPath) raw = JSON.parse(await readFile(resolve(configPath), 'utf8')) as Record<string, unknown>
  if (argv.has('phase')) raw.phase = Number(argv.get('phase'))
  const phase = Number(raw.phase ?? 0)
  const startPhase = Number(raw.startPhase ?? phase)
  const scrub = Number(raw.scrub ?? 0)
  const tumbleCycles = Number(raw.tumbleCycles ?? balancedTiming.tumbleCycles)
  const gradientCycles = Number(raw.gradientCycles ?? balancedTiming.gradientCycles)
  if (!Number.isFinite(phase) || phase < 0 || phase > 2) throw new Error('Phase must be between 0 and 2')
  if (!Number.isInteger(tumbleCycles) || tumbleCycles < 1) throw new Error('Tumble cycles must be a positive integer')
  if (!Number.isInteger(gradientCycles) || gradientCycles < 1) throw new Error('Gradient cycles must be a positive integer')
  return { phase, startPhase, scrub, tumbleCycles, gradientCycles }
}

function sleep(ms: number) {
  return new Promise((resolveSleep) => setTimeout(resolveSleep, ms))
}

async function ensureServer(): Promise<ChildProcess | null> {
  try {
    const response = await fetch('http://localhost:5181/icon-frame.html')
    if (response.ok) return null
  } catch {
    // Start Vite below.
  }
  const vite = resolve(root, 'node_modules/vite/bin/vite.js')
  const child = spawn(process.execPath, [vite, '--port', '5181', '--strictPort'], {
    cwd: root,
    stdio: 'inherit',
  })
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const response = await fetch('http://localhost:5181/icon-frame.html')
      if (response.ok) return child
    } catch {
      await sleep(250)
    }
  }
  child.kill()
  throw new Error('Vite did not start on port 5181')
}

function pngInfo(buffer: Buffer) {
  if (buffer.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') throw new Error('Not a PNG')
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
    colorType: buffer[25],
  }
}

function readBody(req: IncomingMessage) {
  return new Promise<Buffer>((resolveBody, reject) => {
    const chunks: Buffer[] = []
    req.on('data', (chunk: Buffer) => chunks.push(chunk))
    req.on('end', () => resolveBody(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

function receiveFiles(dir: string) {
  return new Promise<{ url: string; close: () => Promise<void> }>((resolveServer) => {
    const server = createServer((req: IncomingMessage, res: ServerResponse) => {
      res.setHeader('access-control-allow-origin', '*')
      res.setHeader('access-control-allow-headers', 'x-name, content-type')
      res.setHeader('access-control-allow-private-network', 'true')
      res.setHeader('access-control-allow-methods', 'POST, OPTIONS')
      if (req.method === 'OPTIONS') {
        res.statusCode = 204
        res.end()
        return
      }
      if (req.method !== 'POST') {
        res.statusCode = 405
        res.end()
        return
      }
      const name = req.headers['x-name']
      if (typeof name !== 'string' || !/^(petals|background|preview)\/[a-z0-9._-]+\.png$/.test(name)) {
        res.statusCode = 400
        res.end('Bad file name')
        return
      }
      void readBody(req).then(async (body) => {
        const info = pngInfo(body)
        if (info.width !== 1024 || info.height !== 1024) {
          throw new Error(`${name} is ${info.width}×${info.height}`)
        }
        if (name.startsWith('petals/') && info.colorType !== 6) {
          throw new Error(`${name} has no alpha channel`)
        }
        const dest = resolve(dir, name)
        await mkdir(dirname(dest), { recursive: true })
        await writeFile(dest, body)
        res.statusCode = 204
        res.end()
      }).catch((error: unknown) => {
        res.statusCode = 500
        res.end(error instanceof Error ? error.message : 'Write failed')
      })
    })
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      const port = typeof address === 'object' && address ? address.port : 0
      resolveServer({
        url: `http://127.0.0.1:${port}/file`,
        close: () => new Promise((resolveClose) => server.close(() => resolveClose())),
      })
    })
  })
}

function readme(report: IconReport, request: Request) {
  return `# Nolume icon layers

These are the 14 bloom petals at phase ${request.phase.toFixed(3)}, each on its own 1024×1024 transparent canvas. They sit where they sit in the full bloom, so they stack without moving them.

## Import into Icon Composer

1. Open the app icon in Xcode's Icon Composer.
2. Drag the files in \`petals/\` in filename order. \`01_petal_back.png\` is the far petal. \`14_petal_front.png\` is the near petal.
3. Select those layers and group them. One group is enough. Icon Composer can then put Liquid Glass on the group or on a single petal.
4. Leave the artwork unmasked. Do not bake the icon's rounded corners into these files.

The dark and light plates in \`background/\` are optional full-canvas fills. They are not part of the petal stack.

## What the previews show

\`preview/complete-bloom.png\` is the original bloom, including the shared glow, on the dark background.

\`preview/reconstructed-bloom.png\` is the petal PNGs stacked in order on that same dark background. The shared glow is not on the petals, so this image is the bloom without that halo.

\`preview/difference.png\` is the absolute RGB difference between the reconstruction and the original bloom drawn without the glow. Mean channel difference against that bare bloom is ${report.againstBare.toFixed(2)}. Against the glowed bloom it is ${report.againstGlow.toFixed(2)}.

The glow is omitted on purpose. Drawing it on every petal would stack the halo fourteen times.

Partial edge pixels: ${report.partial}. Fully transparent pixels: ${report.transparent}. Opaque petal pixels: ${report.opaque}.
`
}

async function main() {
  const argv = flags()
  const request = await readRequest(argv)
  const label = request.phase.toFixed(3).replace('.', '_')
  const outDir = resolve(root, 'exports')
  const packDir = resolve(outDir, `nolume-icon-layers-p${label}`)
  const zipPath = resolve(outDir, `nolume-icon-layers-p${label}.zip`)
  const statusPath = resolve(outDir, 'icon-status.json')
  await mkdir(outDir, { recursive: true })
  await rm(packDir, { recursive: true, force: true })
  await mkdir(packDir, { recursive: true })

  const writeStatus = (state: string, message: string) => {
    writeFileSync(statusPath, JSON.stringify({ state, message }, null, 2))
    console.log(message)
  }

  let cancelled = false
  process.on('SIGTERM', () => {
    cancelled = true
    writeStatus('error', 'Icon export cancelled.')
  })

  const started = await ensureServer()
  const sink = await receiveFiles(packDir)
  let browser: Browser | null = null
  try {
    writeStatus('rendering', `Drawing icon layers at phase ${request.phase.toFixed(3)}…`)
    browser = await chromium.launch({
      channel: 'chrome',
      headless: true,
      args: chromeArgs,
    })
    const page = await browser.newPage({
      viewport: { width: 1024, height: 1024 },
      deviceScaleFactor: 1,
    })
    page.setDefaultTimeout(180000)
    await page.goto('http://localhost:5181/icon-frame.html', { waitUntil: 'domcontentloaded' })
    await page.waitForFunction('window.__nolumeIcon && window.__nolumeIcon.ready === true')
    if (cancelled) throw new Error('Icon export cancelled.')
    const report = await page.evaluate(`window.__nolumeIcon.exportLayers(${JSON.stringify({
      phase: request.phase,
      tumbleCycles: request.tumbleCycles,
      gradientCycles: request.gradientCycles,
      sink: sink.url,
    })})`) as IconReport

    if (report.layers.length !== exportLook.bloom.count) {
      throw new Error(`Expected ${exportLook.bloom.count} petals, got ${report.layers.length}`)
    }
    if (report.transparent === 0) throw new Error('The petal layers have no transparent pixels')
    if (report.againstBare > 12) {
      throw new Error(`Reconstruction is too far from the bare bloom (${report.againstBare.toFixed(2)}).`)
    }

    const manifest = {
      phase: request.phase,
      startPhase: request.startPhase,
      scrub: request.scrub,
      size: 1024,
      palette: exportLook.paletteId,
      surface: exportLook.surface,
      tumbleCycles: request.tumbleCycles,
      gradientCycles: request.gradientCycles,
      tumble: report.tumble,
      drift: report.drift,
      glow: 'Shared glow is on preview/complete-bloom.png only. Petal layers do not include it.',
      comparison: {
        againstGlow: report.againstGlow,
        againstBare: report.againstBare,
        transparentPixels: report.transparent,
        partialPixels: report.partial,
        opaquePixels: report.opaque,
      },
      layers: report.layers.map((layer) => ({
        file: `petals/${layer.fileName}`,
        id: layer.id,
        order: layer.order,
        depth: layer.depth,
      })),
      group: 'Import every petal into one Icon Composer group, in filename order.',
    }
    await writeFile(resolve(packDir, 'manifest.json'), JSON.stringify(manifest, null, 2))
    await writeFile(resolve(packDir, 'README.md'), readme(report, request))

    const zipped = spawnSync('/usr/bin/zip', ['-r', '-X', zipPath, '.'], { cwd: packDir, encoding: 'utf8' })
    if (zipped.status !== 0) throw new Error(zipped.stderr || 'zip failed')

    writeStatus('done', `Saved ${zipPath}. Bare difference ${report.againstBare.toFixed(2)}, glow difference ${report.againstGlow.toFixed(2)}.`)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Icon export failed'
    writeStatus('error', message)
    throw error
  } finally {
    await browser?.close()
    await sink.close()
    if (started) started.kill()
  }
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
