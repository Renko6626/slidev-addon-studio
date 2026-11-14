import type { SourceRange } from '../types'
import { append, getBlock, replaceBlock } from './lines'
import { formatPos, readDrag, writeDrag } from './drag'
import { findAttr, opensWithTag, writeAttr } from './tags'

export type ElementKind = 'text' | 'image'
export interface Size { width: number, height: number }
const STYLE_KEYS = ['font-family', 'font-size', 'color', 'text-align', 'line-height', 'object-fit'] as const

function decode(value: string): string {
  return value.replace(/&(amp|quot|apos|lt|gt|#39);/g, (_, name: string) => ({ amp: '&', quot: '"', apos: "'", lt: '<', gt: '>', '#39': "'" })[name]!)
}
function attribute(block: string, key: string) {
  return decode(findAttr(block, key)?.value ?? '')
}
function escaped(value: string) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
function setAttribute(block: string, key: string, value: string | null) {
  return writeAttr(block, key, value === null ? null : escaped(value))
}

export function readElement(content: string, range: SourceRange) {
  const block = getBlock(content, range)
  const tag = opensWithTag(block)
  const kind = attribute(block, 'data-studio-element')
  if (!((kind === 'text' && tag?.name === 'div') || (kind === 'image' && tag?.name === 'img')))
    return null
  const style = attribute(block, 'style')
  const styles: Record<string, string> = {}
  for (const key of STYLE_KEYS)
    styles[key] = style.match(new RegExp(`(?:^|;)\\s*${key}\\s*:\\s*([^;]*)`, 'i'))?.[1].trim() ?? ''
  return { kind: kind as ElementKind, styles, src: attribute(block, 'src'), alt: attribute(block, 'alt'), lockRatio: kind === 'image' && attribute(block, 'data-studio-lock-ratio') !== 'false' }
}

export function patchElementAttribute(content: string, range: SourceRange, name: string, value: string | null) {
  if (!readElement(content, range))
    return content
  return replaceBlock(content, range, setAttribute(getBlock(content, range), name, value))
}

export function patchElementStyle(content: string, range: SourceRange, patch: Record<string, string | null>) {
  if (!readElement(content, range))
    return content
  const block = getBlock(content, range)
  let style = attribute(block, 'style')
  for (const [key, value] of Object.entries(patch)) {
    if (!(STYLE_KEYS as readonly string[]).includes(key))
      continue
    const pattern = new RegExp(`(^|;)(\\s*${key}\\s*:)\\s*[^;]*`, 'i')
    if (pattern.test(style))
      style = style.replace(pattern, (_, separator, label) => value === null ? separator : `${separator}${label}${value}`)
    else if (value !== null)
      style += `${style && !style.endsWith(';') ? ';' : ''}${key}:${value}`
  }
  return replaceBlock(content, range, setAttribute(block, 'style', style))
}

export function createTextElement(canvas: Size, text: string) {
  const w = Math.round(canvas.width * 0.4)
  const pos = formatPos({ x: (canvas.width - w) / 2, y: (canvas.height - 36.4) / 2, w, h: null, rotate: 0 }, 'attr')
  return `<div data-studio-element="text" v-drag="${pos}" style="font-size:28px;line-height:1.3;text-align:left;white-space:pre-wrap;overflow-wrap:anywhere;min-height:1em;margin:0;padding:0">${escaped(text).replace(/\{\{/g, '&#123;&#123;')}</div>`
}

export function fitImageSize(natural: Size, canvas: Size): Size {
  const scale = Math.min(1, canvas.width * 0.6 / natural.width, canvas.height * 0.65 / natural.height)
  return { width: natural.width * scale, height: natural.height * scale }
}

export function createImageElement(canvas: Size, natural: Size, src: string, alt: string) {
  const size = fitImageSize(natural, canvas)
  const pos = formatPos({ x: (canvas.width - size.width) / 2, y: (canvas.height - size.height) / 2, w: size.width, h: size.height, rotate: 0 }, 'attr')
  let block = `<img data-studio-element="image" v-drag="${pos}" style="object-fit:contain;object-position:center;max-width:none;margin:0;display:block" />`
  block = setAttribute(block, 'src', src)
  return setAttribute(block, 'alt', alt)
}

/** All new objects are independent blocks at the end, with an exact source hint. */
export function appendElement(content: string, snippet: string) {
  const next = append(content, snippet)
  const start = next.slice(0, next.lastIndexOf(snippet)).split('\n').length - 1
  return { content: next, range: [start, start + snippet.split('\n').length] as SourceRange }
}

/** The marked root is known; nested divs do not confuse its closing tag. */
export function replaceTextContent(content: string, range: SourceRange, html: string) {
  if (readElement(content, range)?.kind !== 'text')
    return content
  const block = getBlock(content, range)
  const tag = opensWithTag(block)!
  const end = block.lastIndexOf('</div>')
  if (end < tag.end)
    return content
  return replaceBlock(content, range, block.slice(0, tag.end) + html.replace(/\{\{/g, '&#123;&#123;') + block.slice(end))
}

export function resizeElement(content: string, range: SourceRange, field: 'x' | 'y' | 'w' | 'h' | 'rotate', value: number | null) {
  const element = readElement(content, range)
  const pos = readDrag(content, range)?.pos
  if (!element || !pos || (value !== null && !Number.isFinite(value)))
    return content
  if (field === 'h' && element.kind === 'text')
    return content
  if ((field === 'w' || field === 'h') && (value === null || value <= 0))
    return content
  const next = { ...pos, [field]: value }
  if (element.lockRatio && pos.h && value !== null) {
    if (field === 'w') next.h = value * pos.h / pos.w
    if (field === 'h') next.w = value * pos.w / pos.h
  }
  if (element.kind === 'text') next.h = null
  return writeDrag(content, range, next)
}
