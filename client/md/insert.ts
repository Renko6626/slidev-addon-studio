import type { DragPos, SourceRange, StudioAsset } from '../types'
import { formatPos } from './drag'
import { append, insertAfter } from './lines'

/** Where a newly inserted block should land. */
export type InsertAt =
  | { mode: 'append' }
  | { mode: 'after', range: SourceRange }

export function insertSnippet(content: string, snippet: string, at: InsertAt): string {
  return at.mode === 'after'
    ? insertAfter(content, at.range, snippet)
    : append(content, snippet)
}

/** Wraps a snippet so it lands at a fixed spot on the canvas. */
export function positioned(snippet: string, pos: DragPos): string {
  const trimmed = snippet.trim()
  if (/^<[A-Za-z]/.test(trimmed) && !trimmed.includes('\n'))
    return trimmed.replace(/^<([A-Za-z][\w.-]*)/, `<$1 v-drag="${formatPos(pos, 'attr')}"`)
  return `<v-drag pos="${formatPos(pos, 'prop')}">\n\n${trimmed}\n\n</v-drag>`
}

export function assetSnippet(asset: StudioAsset, alt = ''): string {
  if (asset.kind === 'video' || asset.kind === 'audio')
    return `<StudioMedia kind="${asset.kind}" src="${asset.url.replaceAll('&', '&amp;').replaceAll('"', '&quot;')}" />`
  return `![${alt || asset.name.replace(/\.[^.]+$/, '')}](${asset.url})`
}
