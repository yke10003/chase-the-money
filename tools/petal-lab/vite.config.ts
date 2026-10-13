import { spawn, type ChildProcess } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import type { Connect, Plugin } from 'vite'
import { defineConfig } from 'vite'

function readBody(req: Connect.IncomingMessage) {
  return new Promise<string>((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on('data', (chunk: Buffer) => chunks.push(chunk))
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

function localRender(): Plugin {
  let active: ChildProcess | null = null
  let iconActive: ChildProcess | null = null
  return {
    name: 'local-render',
    configureServer(server) {
      const root = server.config.root
      const outDir = path.resolve(root, 'exports')
      const statusPath = path.resolve(outDir, 'render-status.json')
      const jobPath = path.resolve(outDir, 'render-job.json')
      const logPath = path.resolve(outDir, 'render.log')

      const writeStatus = (state: string, message: string) => {
        fs.mkdirSync(outDir, { recursive: true })
        fs.writeFileSync(statusPath, JSON.stringify({ state, message }, null, 2))
      }

      server.middlewares.use('/local-render', (req, res) => {
        if (req.method === 'GET') {
          if (!fs.existsSync(statusPath)) {
            res.setHeader('content-type', 'application/json')
            res.end(JSON.stringify({ state: 'idle', message: 'No local render yet.' }))
            return
          }
          res.setHeader('content-type', 'application/json')
          res.end(fs.readFileSync(statusPath))
          return
        }

        if (req.method === 'DELETE') {
          if (active && active.exitCode === null) active.kill('SIGTERM')
          writeStatus('error', 'Render cancelled.')
          res.setHeader('content-type', 'application/json')
          res.end(JSON.stringify({ state: 'error', message: 'Render cancelled.' }))
          return
        }

        if (req.method !== 'POST') {
          res.statusCode = 405
          res.end()
          return
        }

        if ((active && active.exitCode === null) || (iconActive && iconActive.exitCode === null)) {
          res.statusCode = 409
          res.end('A local render is already running.')
          return
        }

        void readBody(req).then((body) => {
          const job = JSON.parse(body) as unknown
          if (!job || typeof job !== 'object') throw new Error('Export config must be an object')
          fs.mkdirSync(outDir, { recursive: true })
          fs.writeFileSync(jobPath, JSON.stringify(job, null, 2))
          writeStatus('rendering', 'Starting the local render…')
          const log = fs.openSync(logPath, 'w')
          const tsx = path.resolve(root, 'node_modules/tsx/dist/cli.mjs')
          const script = path.resolve(root, 'scripts/render-loop.ts')
          active = spawn(process.execPath, [tsx, script, '--config', jobPath], {
            cwd: root,
            stdio: ['ignore', log, log],
          })
          active.on('exit', (code) => {
            active = null
            let state = ''
            try {
              state = (JSON.parse(fs.readFileSync(statusPath, 'utf8')) as { state?: string }).state ?? ''
            } catch {
              state = ''
            }
            if (state !== 'done' && state !== 'error') {
              writeStatus('error', `Render process exited (${code ?? 'unknown'}). See exports/render.log`)
            }
          })
          res.setHeader('content-type', 'application/json')
          res.end(JSON.stringify({ state: 'rendering', message: 'Starting the local render…' }))
        }).catch((error: unknown) => {
          res.statusCode = 400
          res.end(error instanceof Error ? error.message : 'Could not start the render')
        })
      })

      const iconStatusPath = path.resolve(outDir, 'icon-status.json')
      const iconJobPath = path.resolve(outDir, 'icon-job.json')
      const iconLogPath = path.resolve(outDir, 'icon.log')
      const writeIconStatus = (state: string, message: string) => {
        fs.mkdirSync(outDir, { recursive: true })
        fs.writeFileSync(iconStatusPath, JSON.stringify({ state, message }, null, 2))
      }

      server.middlewares.use('/icon-layers', (req, res) => {
        if (req.method === 'GET') {
          if (!fs.existsSync(iconStatusPath)) {
            res.setHeader('content-type', 'application/json')
            res.end(JSON.stringify({ state: 'idle', message: 'No icon export yet.' }))
            return
          }
          res.setHeader('content-type', 'application/json')
          res.end(fs.readFileSync(iconStatusPath))
          return
        }
        if (req.method === 'DELETE') {
          if (iconActive && iconActive.exitCode === null) iconActive.kill('SIGTERM')
          writeIconStatus('error', 'Icon export cancelled.')
          res.setHeader('content-type', 'application/json')
          res.end(JSON.stringify({ state: 'error', message: 'Icon export cancelled.' }))
          return
        }
        if (req.method !== 'POST') {
          res.statusCode = 405
          res.end()
          return
        }
        if ((active && active.exitCode === null) || (iconActive && iconActive.exitCode === null)) {
          res.statusCode = 409
          res.end('A local render is already running.')
          return
        }
        void readBody(req).then((body) => {
          fs.mkdirSync(outDir, { recursive: true })
          fs.writeFileSync(iconJobPath, body)
          writeIconStatus('rendering', 'Starting the icon layer export…')
          const log = fs.openSync(iconLogPath, 'w')
          const tsx = path.resolve(root, 'node_modules/tsx/dist/cli.mjs')
          const script = path.resolve(root, 'scripts/export-icon-layers.ts')
          iconActive = spawn(process.execPath, [tsx, script, '--config', iconJobPath], {
            cwd: root,
            stdio: ['ignore', log, log],
            env: { ...process.env, PATH: `/opt/homebrew/bin:${process.env.PATH ?? ''}` },
          })
          iconActive.on('exit', (code) => {
            iconActive = null
            let state = ''
            try {
              state = (JSON.parse(fs.readFileSync(iconStatusPath, 'utf8')) as { state?: string }).state ?? ''
            } catch {
              state = ''
            }
            if (state !== 'done' && state !== 'error') {
              writeIconStatus('error', `Icon export exited (${code ?? 'unknown'}). See exports/icon.log`)
            }
          })
          res.setHeader('content-type', 'application/json')
          res.end(JSON.stringify({ state: 'rendering', message: 'Starting the icon layer export…' }))
        }).catch((error: unknown) => {
          res.statusCode = 400
          res.end(error instanceof Error ? error.message : 'Could not start the icon export')
        })
      })
    },
  }
}

export default defineConfig({
  plugins: [localRender()],
  server: { port: 5181, strictPort: true },
})