export type SheetItem = {
  letter: string
  name: string
  image: CanvasImageSource
}

export function renderContactSheet(items: SheetItem[]): HTMLCanvasElement {
  const width = 2400
  const height = 1760
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) return canvas

  ctx.fillStyle = '#e7e1d6'
  ctx.fillRect(0, 0, width, height)

  ctx.fillStyle = '#1c1915'
  ctx.font = '64px Palatino, "Iowan Old Style", Georgia, serif'
  ctx.fillText('Nolume', 80, 108)
  ctx.font = '28px "Avenir Next", "Segoe UI", sans-serif'
  ctx.fillStyle = '#6d665c'
  ctx.fillText('Icon studies  ·  1024 × 1024', 80, 156)

  const margin = 72
  const top = 210
  const cols = 3
  const rows = 2
  const gapX = 36
  const gapY = 28
  const cellW = (width - margin * 2 - gapX * (cols - 1)) / cols
  const cellH = (height - top - margin - gapY * (rows - 1)) / rows
  const icon = Math.min(cellW - 24, cellH - 72)

  items.slice(0, 6).forEach((item, index) => {
    const col = index % cols
    const row = Math.floor(index / cols)
    const x = margin + col * (cellW + gapX)
    const y = top + row * (cellH + gapY)
    const iconX = x + (cellW - icon) / 2
    const iconY = y + 8
    ctx.fillStyle = '#d9d3c6'
    ctx.fillRect(iconX - 1, iconY - 1, icon + 2, icon + 2)
    ctx.drawImage(item.image, iconX, iconY, icon, icon)
    ctx.fillStyle = '#1c1915'
    ctx.font = '26px "Avenir Next", "Segoe UI", sans-serif'
    ctx.fillText(`${item.letter}   ${item.name}`, iconX, iconY + icon + 42)
  })

  return canvas
}
