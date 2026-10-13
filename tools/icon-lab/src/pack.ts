import { conceptById, concepts } from './concepts'
import { renderContactSheet } from './sheet'
import { renderIcon } from './studio'
import { geometrySvg, hybridSvg } from './svg'
import type { PackFile, Params, RenderMode } from './types'

function blobToBase64(blob: Blob): Promise<string> {
  return blob.arrayBuffer().then((buffer) => {
    const bytes = new Uint8Array(buffer)
    let binary = ''
    const chunk = 0x8000
    for (let index = 0; index < bytes.length; index += chunk) {
      binary += String.fromCharCode(...bytes.subarray(index, index + chunk))
    }
    return btoa(binary)
  })
}

function textFile(name: string, text: string): PackFile {
  return { name, base64: btoa(unescape(encodeURIComponent(text))) }
}

async function canvasFile(name: string, canvas: HTMLCanvasElement): Promise<PackFile> {
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((value) => {
      if (!value) reject(new Error(`Could not encode ${name}`))
      else resolve(value)
    }, 'image/png')
  })
  return { name, base64: await blobToBase64(blob) }
}

export async function buildPack(
  paramsById: Map<string, Params>,
  mode: RenderMode,
): Promise<PackFile[]> {
  const files: PackFile[] = []
  const notes: string[] = [
    'Nolume icon lab export',
    '',
    'PNG files are the finished icons. SVG files named *.geometry.svg are the editable shape layout with flat fills, not the material.',
    'SVG files named *.hybrid.svg embed the sibling PNG by relative path.',
    'Exports freeze animation. Plastic environment drift is off (speed 0), and the light angle is the slider value.',
    '',
  ]
  const sheetItems: { letter: string; name: string; image: HTMLCanvasElement }[] = []

  for (const concept of concepts) {
    const params = paramsById.get(concept.id) ?? concept.defaults
    const rendered = await renderIcon(concept, params, mode)
    const pngName = `${concept.filename}.png`
    files.push(await canvasFile(pngName, rendered.canvas))
    const mark = conceptById(concept.id).compose(params)
    const geometry = geometrySvg(mark, `${concept.letter}. ${concept.name}`)
    files.push(textFile(`${concept.filename}.geometry.svg`, geometry))
    const hybridNote =
      rendered.renderer === 'shader'
        ? 'The linked PNG is the WebGPU shader render (Plastic and Glass).'
        : 'The linked PNG is a canvas painting, used because the shader frame was unavailable or this export was set to paint.'
    files.push(textFile(`${concept.filename}.hybrid.svg`, hybridSvg(pngName, concept.name, hybridNote)))
    notes.push(`${pngName}: ${rendered.renderer}. ${rendered.note}`)
    sheetItems.push({ letter: concept.letter, name: concept.name, image: rendered.canvas })
  }

  const sheet = renderContactSheet(sheetItems)
  files.push(await canvasFile('contact-sheet.png', sheet))
  notes.push('')
  notes.push('contact-sheet.png is a labeled overview. Labels sit outside the icon squares.')
  files.push(textFile('RENDER.txt', notes.join('\n') + '\n'))
  return files
}
