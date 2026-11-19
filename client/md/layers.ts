import type { SourceRange } from '../types'
import { getBlock, replaceBlock } from './lines'
import { readDrag } from './drag'
import { readElement } from './elements'
import { findAttr, opensWithTag, parseAttrs, writeAttr } from './tags'
import { isInteractionTag } from './interactions'

/** Only known single-root elements with a static style can own a saved layer. */
export function canWriteLayer(content: string, range: SourceRange): boolean {
  const block = getBlock(content, range)
  const tag = opensWithTag(block)
  if (!tag || (!readElement(content, range) && !isInteractionTag(tag.name) && tag.name !== 'StudioTable') || readDrag(content, range)?.via !== 'attr')
    return false
  return !parseAttrs(tag.attrs).some(attr => (['style', 'class'].includes(attr.name) && attr.bound) || attr.raw === 'v-bind')
}

export function readLayer(content: string, range: SourceRange): number | null {
  const style = findAttr(getBlock(content, range), 'style')
  if (style?.bound) return null
  const raw = style?.value?.match(/(?:^|;)\s*--studio-z-index\s*:\s*(\d+)\s*(?:;|$)/)?.[1]
  return raw ? Number(raw) : null
}

/** Keep the source range and all other attributes in place. */
export function writeLayer(content: string, range: SourceRange, rank: number): string {
  if (!canWriteLayer(content, range) || !Number.isSafeInteger(rank) || rank < 100)
    return content
  let block = getBlock(content, range)
  // An old inline important z-index would outrank our stylesheet. Replace all
  // old layer declarations, leaving the remaining styles exactly as authored.
  let style = findAttr(block, 'style')?.value ?? ''
  const declaration = /(^|;)\s*(?:z-index|--studio-z-index)\s*:[^;]*(?:;|$)/i
  while (declaration.test(style))
    style = style.replace(declaration, (match, separator) => separator + (match.match(/\n/g)?.join('') ?? ''))
  style += `${style.trim() && !style.trimEnd().endsWith(';') ? ';' : ''}--studio-z-index:${rank}`
  block = writeAttr(block, 'style', style)
  const classes = findAttr(block, 'class')
  if (!classes?.value?.split(/\s+/).includes('studio-layer-object'))
    block = writeAttr(block, 'class', `${classes?.value ? `${classes.value} ` : ''}studio-layer-object`)
  return replaceBlock(content, range, block)
}
