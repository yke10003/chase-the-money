import type { Mark, VectorShape } from './types'

function escapeXml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

function shapeElement(shape: VectorShape): string {
  const cx = (shape.cx * 1024).toFixed(2)
  const cy = (shape.cy * 1024).toFixed(2)
  const fill = shape.role === 'lens' ? 'none' : shape.colorA
  const opacity = shape.role === 'lens' ? '1' : shape.opacity.toFixed(3)
  const stroke = shape.role === 'lens' ? shape.colorB : 'none'
  const strokeWidth = shape.role === 'lens' ? '3' : '0'

  if (shape.kind === 'circle' || shape.role === 'lens') {
    const radius = (shape.rx * 1024).toFixed(2)
    return `<circle cx="${cx}" cy="${cy}" r="${radius}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" opacity="${opacity}"/>`
  }

  if (shape.kind === 'ring') {
    const radius = (shape.rx * 1024).toFixed(2)
    const width = (shape.ry * 2 * 1024).toFixed(2)
    return `<circle cx="${cx}" cy="${cy}" r="${radius}" fill="none" stroke="${shape.colorA}" stroke-width="${width}" opacity="${opacity}"/>`
  }

  const rx = (shape.rx * 1024).toFixed(2)
  const ry = (shape.ry * 1024).toFixed(2)
  const rotation = shape.rotation.toFixed(2)
  return `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${fill}" opacity="${opacity}" transform="rotate(${rotation} ${cx} ${cy})"/>`
}

export function geometrySvg(mark: Mark, title: string): string {
  const shapes = mark.vectors.map(shapeElement).join('\n  ')
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024" role="img">
  <title>${escapeXml(title)} geometry</title>
  <desc>Editable layout geometry only. Fills are flat palette colors. The glossy material is the sibling PNG, rendered by WebGPU shaders, and is not reconstructed here.</desc>
  <rect width="1024" height="1024" fill="${mark.background}"/>
  ${shapes}
</svg>
`
}

export function hybridSvg(pngFilename: string, title: string, rasterNote: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024" role="img">
  <title>${escapeXml(title)}</title>
  <desc>Hybrid SVG. ${escapeXml(rasterNote)} The image is not editable vector artwork.</desc>
  <image href="${escapeXml(pngFilename)}" width="1024" height="1024"/>
</svg>
`
}
