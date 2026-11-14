import type { SourceRange } from '../types'
import { positionedUnit, readDrag, writeDrag } from './drag'
import { getBlock, toLines } from './lines'
import { findWrapper } from './clicks'

export const OBJECT_CLIPBOARD_TYPE = 'application/x-slidev-studio'
export interface CopiedBlock {
  version: 1
  deck: string
  page: number
  source: string
  /** The selectable object inside the copied source (which may include v-drag). */
  range: SourceRange
  tag?: string
}

export function captureBlock(content: string, range: SourceRange, origin: { deck: string, page: number, tag?: string }): CopiedBlock {
  let unit = range
  while (true) {
    const position = positionedUnit(content, unit)
    const clicks = findWrapper(content, position)
    const outer: SourceRange = clicks ? [clicks.open, clicks.close + 1] : position
    if (outer[0] === unit[0] && outer[1] === unit[1]) break
    unit = outer
  }
  return { version: 1, ...origin, source: getBlock(content, unit), range: [range[0] - unit[0], range[1] - unit[0]] }
}

export function encodeClipboard(block: CopiedBlock): string {
  return JSON.stringify(block)
}

export function decodeClipboard(raw: string, deck: string): CopiedBlock | null {
  try {
    const data = JSON.parse(raw)
    if (data?.version !== 1 || data.deck !== deck || !Number.isInteger(data.page) || data.page < 1
      || typeof data.source !== 'string' || !data.source.trim()
      || !Array.isArray(data.range) || data.range.length !== 2
      || !data.range.every(Number.isInteger) || data.range[0] < 0 || data.range[1] <= data.range[0]
      || data.range[1] > data.source.split('\n').length
      || (data.tag !== undefined && typeof data.tag !== 'string'))
      return null
    return data
  }
  catch { return null }
}

export function insertCopiedBlock(content: string, copied: CopiedBlock, offset: number, after?: SourceRange) {
  let snippet = copied.source
  let positionRange = copied.range
  let pos = readDrag(snippet, positionRange)?.pos
  while (!pos) {
    const clicks = findWrapper(snippet, positionRange)
    if (!clicks) break
    positionRange = [clicks.open, clicks.close + 1]
    pos = readDrag(snippet, positionRange)?.pos
  }
  if (pos && offset)
    snippet = writeDrag(snippet, positionRange, { ...pos, x: pos.x + offset, y: pos.y + offset })
  // Keep source indentation. Trimming only the first list item's indentation
  // would change the relationship between its siblings.
  let next: string
  let start: number
  if (after) {
    const lines = toLines(content)
    lines.splice(after[1], 0, '', ...toLines(snippet))
    next = lines.join('\n')
    start = after[1] + 1
  }
  else {
    const prefix = content.replace(/\s+$/, '') + '\n\n'
    next = prefix + snippet + '\n'
    start = toLines(prefix).length - 1
  }
  return { content: next, range: [start + copied.range[0], start + copied.range[1]] as SourceRange }
}
