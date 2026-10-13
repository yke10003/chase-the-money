/**
 * Local bloom render.
 *
 *   npm run render
 *   npm run render -- --preset short --ground light --phase 0.25 --size 768 --fps 24
 *   npm run render -- --seconds 2 --size 768 --fps 24
 *
 * Needs the petal-lab dev server (started automatically if it is down),
 * Google Chrome, and ffmpeg. Frames are rendered in Chrome. FFmpeg encodes the MP4.
 */
import { spawn, spawnSync, type ChildProcess } from 'node:child_process'
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { existsSync, writeFileSync } from 'node:fs'
import { copyFile, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium, type Browser } from 'playwright'
import { exportLook, fileStem, parseExportJob } from '../src/export-config'
import { frameCount, loopPresets, seamPose } from '../src/loop-clock'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const chromeArgs = ['--use-angle=metal', '--enable-unsafe-webgpu']

type Status = {
  state: 'rendering' | 'done' | 'error'
  message: string
  frame?: number
  count?: number
}

function flagMap() {
  const flags = new Map<string, string>()
  const argv = process.argv.slice(2)
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index]
    if (!token?.startsWith('--')) continue
    const value = argv[index + 1]
    if (!value || value.startsWith('--')) flags.set(token.slice(2), 'true')
    else {
      flags.set(token.slice(2), value)
      index += 1
    }
  }
  return flags
}

async function readJob(flags: Map<string, string>) {
  let raw: Record<string, unknown> = {}
  const configPath = flags.get('config')
  if (configPath) {
    raw = JSON.parse(await readFile(resolve(configPath), 'utf8')) as Record<string, unknown>
  }
  const presetId = flags.get('preset')
  if (presetId) {
    const preset = loopPresets.find((item) => item.id === presetId)
    if (!preset) throw new Error('Preset must be short, balanced, or extended')
    raw.seconds = preset.seconds
    raw.tumbleCycles = preset.tumbleCycles
    raw.gradientCycles = preset.gradientCycles
  }
  if (flags.has('ground')) raw.ground = flags.get('ground')
  if (flags.has('phase')) raw.startPhase = Number(flags.get('phase'))
  if (flags.has('seconds')) raw.seconds = Number(flags.get('seconds'))
  if (flags.has('fps')) raw.fps = Number(flags.get('fps'))
  if (flags.has('size')) raw.size = Number(flags.get('size'))
  if (flags.has('crf')) raw.crf = Number(flags.get('crf'))
  if (flags.has('tumble-cycles')) raw.tumbleCycles = Number(flags.get('tumble-cycles'))
  if (flags.has('gradient-cycles')) raw.gradientCycles = Number(flags.get('gradient-cycles'))
  return parseExportJob(raw)
}

function sleep(ms: number) {
  return new Promise((resolveSleep) => setTimeout(resolveSleep, ms))
}

async function serverUp() {
  try {
    const response = await fetch('http://localhost:5181/render.html')
    return response.ok
  } catch {
    return false
  }
}

async function ensureServer(): Promise<ChildProcess | null> {
  if (await serverUp()) return null
  const vite = resolve(root, 'node_modules/vite/bin/vite.js')
  const child = spawn(process.execPath, [vite, '--port', '5181', '--strictPort'], {
    cwd: root,
    stdio: 'inherit',
  })
  for (let attempt = 0; attempt < 40; attempt += 1) {
    if (await serverUp()) return child
    await sleep(250)
  }
  child.kill()
  throw new Error('Vite did not start on port 5181')
}

function toolPath(name: string) {
  const found = spawnSync('/usr/bin/which', [name], { encoding: 'utf8' })
  const fromPath = found.status === 0 ? found.stdout.trim() : ''
  if (fromPath) return fromPath
  const fallback = `/opt/homebrew/bin/${name}`
  if (existsSync(fallback)) return fallback
  throw new Error(`${name} is not installed`)
}

function pngSize(buffer: Buffer) {
  if (buffer.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') throw new Error('Not a PNG')
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) }
}

function readBody(req: IncomingMessage) {
  return new Promise<Buffer>((resolveBody, reject) => {
    const chunks: Buffer[] = []
    req.on('data', (chunk: Buffer) => chunks.push(chunk))
    req.on('end', () => resolveBody(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

function frameServer(frameDir: string) {
  return new Promise<{ url: string; close: () => Promise<void> }>((resolveServer) => {
    const server = createServer((req: IncomingMessage, res: ServerResponse) => {
      res.setHeader('access-control-allow-origin', '*')
      res.setHeader('access-control-allow-headers', 'x-frame, content-type')
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
      const index = Number(req.headers['x-frame'])
      if (!Number.isInteger(index) || index < 0) {
        res.statusCode = 400
        res.end('Bad frame index')
        return
      }
      void readBody(req).then(async (body) => {
        const size = pngSize(body)
        const name = `frame-${String(index).padStart(6, '0')}.png`
        await writeFile(resolve(frameDir, name), body)
        res.setHeader('content-type', 'application/json')
        res.end(JSON.stringify({ index, width: size.width, height: size.height, bytes: body.length }))
      }).catch((error: unknown) => {
        res.statusCode = 500
        res.end(error instanceof Error ? error.message : 'Frame write failed')
      })
    })
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      const port = typeof address === 'object' && address ? address.port : 0
      resolveServer({
        url: `http://127.0.0.1:${port}/frame`,
        close: () => new Promise((resolveClose) => server.close(() => resolveClose())),
      })
    })
  })
}

async function setStatus(statusPath: string, status: Status) {
  await writeFile(statusPath, JSON.stringify(status, null, 2))
  console.log(status.message)
}

async function launchChrome(): Promise<Browser> {
  const options = { channel: 'chrome' as const, args: chromeArgs }
  try {
    return await chromium.launch({ ...options, headless: true })
  } catch (error) {
    console.log(error instanceof Error ? error.message : 'Headless Chrome failed')
    return chromium.launch({ ...options, headless: false })
  }
}

function probe(ffprobe: string, file: string) {
  const result = spawnSync(ffprobe, [
    '-v', 'error',
    '-select_streams', 'v:0',
    '-count_frames',
    '-show_entries', 'stream=width,height,codec_name,nb_read_frames,duration',
    '-of', 'json',
    file,
  ], { encoding: 'utf8' })
  if (result.status !== 0) throw new Error(result.stderr || 'ffprobe failed')
  const parsed = JSON.parse(result.stdout) as {
    streams?: { width?: number; height?: number; codec_name?: string; nb_read_frames?: string; duration?: string }[]
  }
  const stream = parsed.streams?.[0]
  if (!stream) throw new Error('ffprobe found no video stream')
  return stream
}

async function main() {
  const ffmpeg = toolPath('ffmpeg')
  const ffprobe = toolPath('ffprobe')
  const flags = flagMap()
  const job = await readJob(flags)
  const count = frameCount(job.seconds, job.fps)
  const pose = seamPose(job.startPhase, count, job, exportLook.knobs)
  if (!pose.poseClosed || !pose.motionClosed) {
    throw new Error('Loop pose does not close. Check the cycle counts.')
  }

  const outDir = resolve(root, flags.get('out') ?? 'exports')
  const stem = fileStem(job)
  const frameDir = resolve(outDir, `.frames-${stem}`)
  const posterPath = resolve(outDir, `${stem}.png`)
  const videoPath = resolve(outDir, `${stem}.mp4`)
  const statusPath = resolve(outDir, 'render-status.json')
  await mkdir(outDir, { recursive: true })
  await rm(frameDir, { recursive: true, force: true })
  await mkdir(frameDir, { recursive: true })

  let cancelled = false
  const onStop = () => {
    cancelled = true
    writeFileSync(statusPath, JSON.stringify({
      state: 'error',
      message: 'Render cancelled.',
      count,
    }, null, 2))
  }
  process.on('SIGTERM', onStop)
  process.on('SIGINT', onStop)

  const started = await ensureServer()
  const sink = await frameServer(frameDir)
  let browser: Browser | null = null
  try {
    await setStatus(statusPath, { state: 'rendering', message: 'Opening Chrome…', frame: 0, count })
    browser = await launchChrome()
    const page = await browser.newPage({
      viewport: { width: job.size, height: job.size },
      deviceScaleFactor: 1,
    })
    page.setDefaultTimeout(180000)
    await page.goto('http://localhost:5181/render.html', { waitUntil: 'domcontentloaded' })
    await page.waitForFunction('window.__nolume && window.__nolume.ready === true')
    await page.evaluate(`(async () => {
      await window.__nolume.apply(${JSON.stringify(job)}, ${JSON.stringify(sink.url)})
    })()`)

    await setStatus(statusPath, { state: 'rendering', message: 'Checking the seam…', frame: 0, count })
    const seam = await page.evaluate('window.__nolume.measureSeam()') as {
      smooth: boolean
      join: number
      step: number
      wrap: number
    }
    if (!seam.smooth) {
      throw new Error(`Seam is visible. Join ${seam.join.toFixed(2)}, step ${seam.step.toFixed(2)}, wrap ${seam.wrap.toFixed(2)}.`)
    }
    console.log(`Seam holds. Join ${seam.join.toFixed(2)}, step ${seam.step.toFixed(2)}, wrap ${seam.wrap.toFixed(2)}.`)

    for (let index = 0; index < count; index += 1) {
      if (cancelled) throw new Error('Render cancelled.')
      await page.evaluate(`window.__nolume.renderFrame(${index})`)
      if (index === 0) {
        const firstSize = pngSize(await readFile(resolve(frameDir, 'frame-000000.png')))
        if (firstSize.width !== job.size || firstSize.height !== job.size) {
          throw new Error(`Frame is ${firstSize.width}×${firstSize.height}, expected ${job.size}.`)
        }
      }
      if (index % 10 === 0 || index === count - 1) {
        await setStatus(statusPath, {
          state: 'rendering',
          message: `Rendering ${index + 1} / ${count}`,
          frame: index + 1,
          count,
        })
      }
    }

    const first = await readFile(resolve(frameDir, 'frame-000000.png'))
    const firstSize = pngSize(first)
    if (firstSize.width !== job.size || firstSize.height !== job.size) {
      throw new Error(`Poster is ${firstSize.width}×${firstSize.height}, expected ${job.size}.`)
    }
    await copyFile(resolve(frameDir, 'frame-000000.png'), posterPath)

    await setStatus(statusPath, { state: 'rendering', message: 'Encoding the MP4…', frame: count, count })
    const encoded = spawnSync(ffmpeg, [
      '-y',
      '-framerate', String(job.fps),
      '-start_number', '0',
      '-i', resolve(frameDir, 'frame-%06d.png'),
      '-frames:v', String(count),
      '-c:v', 'libx264',
      '-pix_fmt', 'yuv420p',
      '-crf', String(job.crf),
      '-preset', 'slow',
      '-movflags', '+faststart',
      '-an',
      videoPath,
    ], { stdio: 'inherit' })
    if (encoded.status !== 0) throw new Error('ffmpeg failed')

    const stream = probe(ffprobe, videoPath)
    const frames = Number(stream.nb_read_frames)
    const duration = Number(stream.duration)
    if (stream.codec_name !== 'h264') throw new Error(`Expected H.264, got ${stream.codec_name}`)
    if (stream.width !== job.size || stream.height !== job.size) {
      throw new Error(`Video is ${stream.width}×${stream.height}`)
    }
    if (frames !== count) throw new Error(`Video has ${frames} frames, expected ${count}`)
    if (!Number.isFinite(duration) || Math.abs(duration - job.seconds) > 1.5 / job.fps) {
      throw new Error(`Video duration is ${duration}s, expected ${job.seconds}s`)
    }

    await rm(frameDir, { recursive: true, force: true })
    await setStatus(statusPath, {
      state: 'done',
      message: `Saved ${videoPath} and ${posterPath}. ${count} frames, ${job.seconds}s, seam join ${seam.join.toFixed(2)}.`,
      frame: count,
      count,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Render failed'
    await setStatus(statusPath, { state: 'error', message, count })
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
