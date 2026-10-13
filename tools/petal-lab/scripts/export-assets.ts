import { spawn, type ChildProcess } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import puppeteer from 'puppeteer-core'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const outDir = resolve(root, 'exports')
const url = 'http://localhost:5181/'
const chrome = process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'

type PackFile = { name: string; base64: string }

async function up(): Promise<boolean> {
  try {
    const response = await fetch(url)
    return response.ok
  } catch {
    return false
  }
}

function sleep(ms: number) {
  return new Promise((resolveSleep) => setTimeout(resolveSleep, ms))
}

async function ensureServer(): Promise<ChildProcess | null> {
  if (await up()) return null
  const vite = resolve(root, 'node_modules/vite/bin/vite.js')
  const child = spawn(process.execPath, [vite, '--port', '5181', '--strictPort'], {
    cwd: root,
    stdio: 'inherit',
  })
  for (let attempt = 0; attempt < 40; attempt += 1) {
    if (await up()) return child
    await sleep(250)
  }
  child.kill()
  throw new Error('Vite did not start')
}

function pngSize(buffer: Buffer) {
  if (buffer.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') throw new Error('Not a PNG')
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) }
}

const started = await ensureServer()
const browser = await puppeteer.launch({
  executablePath: chrome,
  headless: true,
  args: ['--use-angle=metal'],
})

try {
  const page = await browser.newPage()
  page.setDefaultTimeout(60000)
  await page.setViewport({ width: 1400, height: 1400, deviceScaleFactor: 1 })
  await page.goto(url, { waitUntil: 'domcontentloaded' })
  await page.waitForFunction(() => document.body.dataset.ready === 'true')
  const files = (await page.evaluate(async () => {
    const api = window.__petalLab
    if (!api) throw new Error('Petal lab API missing')
    return api.exportPack()
  })) as PackFile[]
  await mkdir(outDir, { recursive: true })
  for (const file of files) {
    const buffer = Buffer.from(file.base64, 'base64')
    if (file.name.endsWith('.png')) {
      const size = pngSize(buffer)
      const icon = file.name !== 'contact-sheet.png'
      if (icon && (size.width !== 1024 || size.height !== 1024)) {
        throw new Error(`${file.name} is ${size.width}×${size.height}`)
      }
      console.log(`${file.name} ${size.width}×${size.height} ${buffer.length}`)
    }
    await writeFile(resolve(outDir, file.name), buffer)
  }
} finally {
  await browser.close()
  if (started) started.kill()
}
