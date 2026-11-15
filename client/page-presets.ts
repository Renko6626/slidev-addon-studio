import type { MessageKey } from './i18n'
import type { Size } from './md/elements'
import { createImageElement, createTextElement, patchElementStyle } from './md/elements'
import { writeDrag } from './md/drag'

interface PresetBox {
  kind: 'text' | 'image'
  text: MessageKey
  x: number
  y: number
  w: number
  h: number
  font?: number
  align?: 'left' | 'center'
}
export interface PagePreset {
  id: string
  label: MessageKey
  boxes: PresetBox[]
}

const title: PresetBox = { kind: 'text', text: 'presetTitleText', x: 0.06, y: 0.08, w: 0.88, h: 0.14, font: 40 }
const body: PresetBox = { kind: 'text', text: 'presetBodyText', x: 0.06, y: 0.30, w: 0.88, h: 0.58, font: 26 }
const picture: PresetBox = { kind: 'image', text: 'presetPictureText', x: 0.06, y: 0.30, w: 0.42, h: 0.58 }

export const PAGE_PRESETS: PagePreset[] = [
  { id: 'blank', label: 'presetBlank', boxes: [] },
  { id: 'title', label: 'presetTitle', boxes: [
    { ...title, y: 0.31, font: 52, align: 'center' },
    { ...body, text: 'presetSubtitleText', y: 0.53, h: 0.18, font: 24, align: 'center' },
  ] },
  { id: 'content', label: 'presetContent', boxes: [title, body] },
  { id: 'columns', label: 'presetColumns', boxes: [title, { ...body, text: 'presetLeftText', w: 0.42 }, { ...body, text: 'presetRightText', x: 0.52, w: 0.42 }] },
  { id: 'image-left', label: 'presetImageLeft', boxes: [title, picture, { ...body, x: 0.52, w: 0.42 }] },
  { id: 'image-right', label: 'presetImageRight', boxes: [title, { ...body, w: 0.42 }, { ...picture, x: 0.52 }] },
  { id: 'image', label: 'presetImage', boxes: [{ ...picture, x: 0, y: 0, w: 1, h: 1 }] },
]

/** An actual, replaceable image; no missing file or network request. */
export function picturePlaceholder() {
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="260" viewBox="0 0 400 260"><rect width="400" height="260" fill="#e8edf2"/><rect x="145" y="88" width="110" height="84" rx="4" fill="none" stroke="#8192a5" stroke-width="3"/><circle cx="176" cy="111" r="8" fill="#8192a5"/><path d="M148 158l29-29 23 22 18-18 34 31" fill="none" stroke="#8192a5" stroke-width="3"/></svg>'
  return `data:image/svg+xml,${encodeURIComponent(svg)}`
}

/** Shared geometry and copy for the gallery and the saved page. */
export function pagePresetElements(preset: PagePreset, canvas: Size, translate: (key: MessageKey) => string) {
  const scale = Math.min(canvas.width / 1000, canvas.height / 562.5)
  return preset.boxes.map(box => ({
    ...box,
    text: translate(box.text),
    x: canvas.width * box.x, y: canvas.height * box.y,
    w: canvas.width * box.w, h: canvas.height * box.h,
    font: (box.font ?? 26) * scale,
    align: box.align ?? 'left',
    src: box.kind === 'image' ? picturePlaceholder() : '',
  }))
}

export function createPresetPage(preset: PagePreset, canvas: Size, translate: (key: MessageKey) => string) {
  const content = pagePresetElements(preset, canvas, translate).map(box => {
    let source = box.kind === 'image'
      ? createImageElement(canvas, { width: box.w, height: box.h }, box.src, box.text)
      : createTextElement(canvas, box.text)
    source = writeDrag(source, [0, 1], { x: box.x, y: box.y, w: box.w, h: box.kind === 'text' ? null : box.h, rotate: 0 })
    return patchElementStyle(source, [0, 1], box.kind === 'text'
      ? { 'font-size': `${box.font}px`, 'text-align': box.align }
      : { 'object-fit': 'cover' })
  }).join('\n\n')
  return { content, frontmatter: `layout: none\ntitle: ${JSON.stringify(translate(preset.label))}` }
}
