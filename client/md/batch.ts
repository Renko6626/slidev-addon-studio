import type { DragPos, SourceRange } from '../types'
import { positionedUnit, readDrag, writeDrag } from './drag'
import { removeBlock } from './lines'
import { captureBlock, insertCopiedBlock } from './clipboard'
import type { CopiedBlock } from './clipboard'
import { scanTags } from '../../node/html-scan'

/** Independent source ranges are edited from the bottom, preserving earlier ranges. */
export function writePositions(content: string, changes: { range: SourceRange, pos: DragPos }[]) {
  return [...changes].sort((a, b) => b.range[0] - a.range[0])
    .reduce((next, change) => writeDrag(next, change.range, change.pos), content)
}

export function movePositions(content: string, ranges: SourceRange[], dx: number, dy: number) {
  return writePositions(content, ranges.flatMap(range => {
    const pos = readDrag(content, range)?.pos
    return pos ? [{ range, pos: { ...pos, x: pos.x + dx, y: pos.y + dy } }] : []
  }))
}

export function removePositions(content: string, ranges: SourceRange[]) {
  const units = ranges.map(range => positionedUnit(content, range))
  return units.sort((a, b) => b[0] - a[0]).reduce((next, range) => removeBlock(next, range), content)
}

export function captureBlocks(content: string, targets: { range: SourceRange, tag?: string }[], origin: { deck: string, page: number }) {
  return [...targets].sort((a, b) => a.range[0] - b.range[0])
    .map(target => captureBlock(content, target.range, { ...origin, tag: target.tag }))
}

export function insertCopiedBlocks(content: string, copied: CopiedBlock[], offset: number) {
  const inserted: { range: SourceRange, tag?: string }[] = []
  for (const block of copied) {
    const result = insertCopiedBlock(content, block, offset)
    content = result.content
    inserted.push({ range: result.range, tag: block.tag })
  }
  return { content, inserted }
}

/** Multi-copy keeps the existing clipboard envelope: ordinary Markdown source. */
export function combineCopiedBlocks(copied: CopiedBlock[]): CopiedBlock {
  return { ...copied[0], source: copied.map(block => block.source).join('\n\n') }
}

/** Recover independent positioned roots from copied Markdown, without a second format. */
export function splitCopiedBlocks(copied: CopiedBlock): CopiedBlock[] {
  const tags = scanTags(copied.source)
  const positioned = tags.filter(tag => /^v-?drag$/i.test(tag.name) || /(?:^|\s)v-drag(?:=|\s|$)/.test(tag.attrs))
  const roots = positioned.filter(tag => !positioned.some(parent => parent !== tag && parent.start < tag.start && parent.endLine >= tag.endLine))
  const owners = roots.map(root => tags.find(tag => tag.depth === 0 && tag.start <= root.start && tag.endLine >= root.endLine))
  if (roots.length < 2 || new Set(owners).size !== roots.length) return [copied]
  return roots.map(tag => captureBlock(copied.source, [tag.startLine, tag.endLine], { deck: copied.deck, page: copied.page, tag: tag.name }))
}
