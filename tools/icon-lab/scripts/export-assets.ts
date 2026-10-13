import { spawn, type ChildProcess } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import puppeteer from 'puppeteer-core'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const outDir = resolve(root, 'exports')
const port = 5179
const url = `http://localhost:${port}/?export=1`

type PackFile = { name: string; base64: string }

async function serverUp(): Promise<boolean> {
  try {
    const response = await fetch(url)
    return response.ok
  } catch {
    return false
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolveSleep) => setTimeout(resolveSleep, ms))
}

async function ensureServer(): Promise<ChildProcess | null> {
  if (await serverUp()) return null
  const vite = resolve(root, 'node_modules/vite/bin/vite.js')
  const child = spawn(process.execPath, [vite, '--port', String(port), '--strictPort'], {
    cwd: root,
    stdio: 'inherit',
  })
  for (let attempt = 0; attempt < 40; attempt += 1) {
    if (await serverUp()) return child
    await sleep(250)
  }
  child.kill()
  throw new Error('Vite did not start')
}

function pngSize(buffer: Buffer): { width: number; height: number } {
  const signature = buffer.subarray(0, 8).toString('hex')
  if (signature !== '89504e470d0a1a0a') throw new Error('Not a PNG')
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) }
}

const chrome =
  process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'

const started = await ensureServer()
const browser = await puppeteer.launch({
  executablePath: chrome,
  headless: true,
  args: ['--enable-unsafe-webgpu', '--use-angle=metal'],
})

try {
  const page = await browser.newPage()
  page.setDefaultTimeout(180000)
  await page.setViewport({ width: 1400, height: 1400, deviceScaleFactor: 1 })
  page.on('console', (message) => {
    const text = message.text()
    if (text.includes('shader') || message.type() === 'error') console.log(`page: ${text}`)
  })
  page.on('pageerror', (error) => console.log(`page error: ${error.message}`))
  await page.goto(url, { waitUntil: 'domcontentloaded' })
  await page.waitForFunction(() => document.body.dataset.ready === 'true')
  console.log('page ready, rendering icons')
  const files = await page.evaluate(async () => {
    const api = window.__nolumeIconLab
    if (!api) throw new Error('Icon lab API missing')
    return api.exportPack()
  })
  await mkdir(outDir, { recursive: true })
  for (const file of files as PackFile[]) {
    const buffer = Buffer.from(file.base64, 'base64')
    const target = resolve(outDir, file.name)
    if (file.name.endsWith('.png')) {
      const size = pngSize(buffer)
      const icon = /^\d\d-/.test(file.name)
      if (icon && (size.width !== 1024 || size.height !== 1024)) {
        throw new Error(`${file.name} is ${size.width}×${size.height}`)
      }
      if (buffer.length < 8000) throw new Error(`${file.name} looks empty (${buffer.length} bytes)`)
      console.log(`${file.name} ${size.width}×${size.height} ${buffer.length} bytes`)
    } else {
      console.log(`${file.name} ${buffer.length} bytes`)
    }
    await writeFile(target, buffer)
  }
} finally {
  await browser.close()
  if (started) started.kill()
}
