import { clamp, mixHex, shade } from './color'
import type { Mark, Params, VectorShape } from './types'

function snapshot(canvas: HTMLCanvasElement): HTMLCanvasElement {
  const copy = document.createElement('canvas')
  copy.width = canvas.width
  copy.height = canvas.height
  const ctx = copy.getContext('2d')
  if (!ctx) return copy
  ctx.drawImage(canvas, 0, 0)
  return copy
}

function localLight(params: Params, shape: VectorShape): { x: number; y: number } {
  const rad = ((params.light + shape.lightOffset - shape.rotation) * Math.PI) / 180
  return { x: Math.sin(rad), y: -Math.cos(rad) }
}

function fillEllipse(ctx: CanvasRenderingContext2D, rx: number, ry: number) {
  ctx.beginPath()
  ctx.ellipse(0, 0, Math.max(rx, 0.5), Math.max(ry, 0.5), 0, 0, Math.PI * 2)
  ctx.fill()
}

function drawBody(
  ctx: CanvasRenderingContext2D,
  shape: VectorShape,
  params: Params,
  size: number,
) {
  const cx = shape.cx * size
  const cy = shape.cy * size
  const rx = (shape.kind === 'circle' ? shape.rx : shape.rx) * size
  const ry = (shape.kind === 'circle' ? shape.rx : shape.ry) * size
  const light = localLight(params, shape)
  const highlight = clamp(params.highlight, 0, 1)

  ctx.save()
  ctx.globalAlpha = shape.opacity
  ctx.translate(cx, cy)
  ctx.rotate((shape.rotation * Math.PI) / 180)

  ctx.save()
  ctx.shadowColor = 'rgba(28, 16, 24, 0.32)'
  ctx.shadowBlur = size * 0.014
  ctx.shadowOffsetX = size * 0.004
  ctx.shadowOffsetY = size * 0.01
  ctx.fillStyle = shape.colorB
  fillEllipse(ctx, rx, ry)
  ctx.restore()

  ctx.save()
  ctx.beginPath()
  ctx.ellipse(0, 0, Math.max(rx, 0.5), Math.max(ry, 0.5), 0, 0, Math.PI * 2)
  ctx.clip()

  const gradient = ctx.createLinearGradient(-rx * 0.15, -ry, rx * 0.2, ry)
  if (shape.stops && shape.stops.length > 1) {
    for (const stop of shape.stops) gradient.addColorStop(clamp(stop.position, 0, 1), stop.color)
  } else {
    gradient.addColorStop(0, mixHex(shape.colorA, '#ffffff', 0.42))
    gradient.addColorStop(0.38, shape.colorA)
    gradient.addColorStop(1, shape.colorB)
  }
  ctx.fillStyle = gradient
  ctx.fillRect(-rx * 2, -ry * 2, rx * 4, ry * 4)

  ctx.globalCompositeOperation = 'multiply'
  const shadeGradient = ctx.createLinearGradient(0, -ry * 0.35, 0, ry)
  shadeGradient.addColorStop(0, 'rgba(255,255,255,1)')
  shadeGradient.addColorStop(0.55, 'rgba(255,255,255,1)')
  shadeGradient.addColorStop(1, 'rgba(92, 58, 72, 1)')
  ctx.fillStyle = shadeGradient
  ctx.fillRect(-rx * 2, -ry * 2, rx * 4, ry * 4)

  ctx.globalCompositeOperation = 'screen'
  const specX = light.x * rx * 0.22
  const specY = light.y * ry * 0.34
  const specular = ctx.createRadialGradient(specX, specY, size * 0.004, specX, specY, Math.max(rx, ry) * 0.85)
  specular.addColorStop(0, `rgba(255,255,255,${0.82 * highlight})`)
  specular.addColorStop(0.16, `rgba(255,255,255,${0.28 * highlight})`)
  specular.addColorStop(0.48, 'rgba(255,255,255,0)')
  ctx.fillStyle = specular
  ctx.fillRect(-rx * 2, -ry * 2, rx * 4, ry * 4)

  const bounce = ctx.createRadialGradient(-specX, -specY, ry * 0.05, -specX * 0.4, -specY * 0.3, Math.max(rx, ry))
  bounce.addColorStop(0, mixHex(shape.colorB, '#ffffff', 0.15))
  bounce.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.globalAlpha = shape.opacity * 0.35
  ctx.fillStyle = bounce
  ctx.fillRect(-rx * 2, -ry * 2, rx * 4, ry * 4)

  ctx.restore()

  ctx.globalCompositeOperation = 'source-over'
  ctx.globalAlpha = shape.opacity
  ctx.beginPath()
  ctx.ellipse(0, 0, Math.max(rx, 0.5), Math.max(ry, 0.5), 0, 0, Math.PI * 2)
  ctx.clip()
  const rim = ctx.createLinearGradient(light.x * rx, light.y * ry, -light.x * rx, -light.y * ry)
  rim.addColorStop(0, `rgba(255,255,255,${0.85 * highlight})`)
  rim.addColorStop(0.45, 'rgba(255,255,255,0.08)')
  rim.addColorStop(1, mixHex(shape.colorB, '#000000', 0.15))
  ctx.strokeStyle = rim
  ctx.lineWidth = Math.max(1.5, Math.min(rx, ry) * 0.09)
  ctx.stroke()

  ctx.globalCompositeOperation = 'source-over'
  ctx.fillStyle = `rgba(255,255,255,${0.9 * highlight})`
  ctx.beginPath()
  ctx.ellipse(specX * 0.85, specY * 0.75, Math.max(rx * 0.045, 1), Math.max(ry * 0.03, 0.8), 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

function drawLens(
  ctx: CanvasRenderingContext2D,
  source: HTMLCanvasElement,
  shape: VectorShape,
  params: Params,
  size: number,
) {
  const cx = shape.cx * size
  const cy = shape.cy * size
  const radius = shape.rx * size
  const light = localLight(params, shape)
  const highlight = clamp(params.highlight, 0, 1)

  ctx.save()
  ctx.beginPath()
  ctx.arc(cx, cy, radius, 0, Math.PI * 2)
  ctx.clip()
  ctx.translate(cx, cy)
  ctx.scale(1.07, 1.07)
  ctx.translate(-cx, -cy)
  ctx.drawImage(source, 0, 0)
  ctx.restore()

  ctx.save()
  ctx.beginPath()
  ctx.arc(cx, cy, radius, 0, Math.PI * 2)
  ctx.clip()

  const specX = cx + light.x * radius * 0.28
  const specY = cy + light.y * radius * 0.28
  const glare = ctx.createRadialGradient(specX, specY, radius * 0.02, specX, specY, radius * 0.95)
  glare.addColorStop(0, `rgba(255,255,255,${0.55 * highlight})`)
  glare.addColorStop(0.35, 'rgba(255,255,255,0.08)')
  glare.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = glare
  ctx.fillRect(cx - radius, cy - radius, radius * 2, radius * 2)

  const edge = shade(shape.colorB, -0.1)
  ctx.strokeStyle = mixHex(edge, '#ffffff', 0.65)
  ctx.globalAlpha = 0.55
  ctx.lineWidth = Math.max(2, radius * 0.045)
  ctx.beginPath()
  ctx.arc(cx, cy, radius - ctx.lineWidth * 0.4, 0, Math.PI * 2)
  ctx.stroke()
  ctx.restore()
}

export function paintMark(canvas: HTMLCanvasElement, mark: Mark, params: Params) {
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  const size = canvas.width
  ctx.clearRect(0, 0, size, canvas.height)
  ctx.fillStyle = mark.background
  ctx.fillRect(0, 0, size, canvas.height)

  const spot = ctx.createRadialGradient(size * 0.46, size * 0.4, size * 0.04, size * 0.5, size * 0.5, size * 0.72)
  spot.addColorStop(0, mixHex(mixHex(mark.background, '#ffffff', 0.2), mark.accent, 0.18))
  spot.addColorStop(1, mark.background)
  ctx.fillStyle = spot
  ctx.fillRect(0, 0, size, canvas.height)

  for (const shape of mark.vectors) {
    if (shape.role === 'lens') {
      const copy = snapshot(canvas)
      drawLens(ctx, copy, shape, params, size)
      continue
    }
    if (shape.kind === 'ring') {
      ctx.save()
      ctx.translate(shape.cx * size, shape.cy * size)
      ctx.strokeStyle = shape.colorA
      ctx.globalAlpha = shape.opacity
      ctx.lineWidth = shape.ry * size * 2
      ctx.beginPath()
      ctx.arc(0, 0, shape.rx * size, 0, Math.PI * 2)
      ctx.stroke()
      ctx.restore()
      continue
    }
    drawBody(ctx, shape, params, size)
  }
}

export function paintToCanvas(mark: Mark, params: Params, size = 1024): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  paintMark(canvas, mark, params)
  return canvas
}
