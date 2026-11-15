import type { SourceRange } from '../types'
import { replaceBlock, toLines } from './lines'
import { findAttr, opensWithTag } from './tags'

export interface PageBackground { kind: 'color' | 'image', value: string }

function decode(value: string) {
  return value.replace(/&(amp|quot|lt|gt|#39);/g, (_, name: string) => ({ amp: '&', quot: '"', lt: '<', gt: '>', '#39': "'" })[name]!)
}
function escape(value: string) {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/** Studio's background is a standalone, one-line element before the objects. */
export function readPageBackground(content: string): (PageBackground & { range: SourceRange }) | null {
  const lines = toLines(content)
  const start = lines.findIndex(line => line.trim())
  const block = lines[start] ?? ''
  const tag = opensWithTag(block)
  if (!tag || !findAttr(block, 'data-studio-background')) return null
  const range: SourceRange = [start, start + 1]
  if (tag.name === 'img')
    return { kind: 'image', value: decode(findAttr(block, 'src')?.value ?? ''), range }
  if (tag.name !== 'div') return null
  const style = decode(findAttr(block, 'style')?.value ?? '')
  return { kind: 'color', value: style.match(/(?:^|;)\s*background-color\s*:\s*([^;]*)/i)?.[1].trim() ?? '', range }
}

export function setPageBackground(content: string, background: PageBackground | null) {
  const current = readPageBackground(content)
  if (!background?.value) {
    if (!current) return content
    const lines = toLines(content)
    lines.splice(current.range[0], 1)
    if (lines[current.range[0]] === '') lines.splice(current.range[0], 1)
    return lines.join('\n')
  }
  // Slidev's positioned objects use z-index:100. This stays above the slide's
  // own paint and below those objects in editor, thumbnails and static builds.
  const style = 'position:absolute;inset:0;width:100%;height:100%;z-index:0;pointer-events:none;margin:0;max-width:none'
  const snippet = background.kind === 'image'
    ? `<img data-studio-background src="${escape(background.value)}" alt="" aria-hidden="true" style="${style};object-fit:cover;object-position:center;display:block" />`
    : `<div data-studio-background aria-hidden="true" style="${style};background-color:${escape(background.value)}"></div>`
  return current ? replaceBlock(content, current.range, snippet) : `${snippet}\n\n${content}`
}
