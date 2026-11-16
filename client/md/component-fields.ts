import type { PropMeta, SourceRange } from '../types'
import { getBlock, replaceBlock } from './lines'
import { opensWithTag, parseAttrs, sameAttr, writeAttr } from './tags'
import { parseStringArray } from './literals'

export type ComponentString =
  | { editable: true, value: string, explicit: boolean }
  | { editable: false, reason: 'dynamic' | 'unknown-default' | 'ambiguous' }

function decode(value: string): string {
  return value.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (all, key: string) => {
    if (key[0] !== '#') return ({ amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" } as Record<string, string>)[key] ?? all
    const code = key[1].toLowerCase() === 'x' ? parseInt(key.slice(2), 16) : Number(key.slice(1))
    return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : all
  })
}

function literal(raw: string | undefined): string | null {
  if (raw === undefined) return null
  const value = raw.trim()
  try { const parsed = JSON.parse(value); if (typeof parsed === 'string') return parsed }
  catch { /* The existing literal reader also supports simple single quotes. */ }
  if (!/^'(?:[^'\\]|\\[\\'"nrtbfv0])*'$/.test(value)) return null
  const values = parseStringArray(`[${value}]`)
  return values?.length === 1 ? values[0] : null
}

export function readComponentString(content: string, range: SourceRange, prop: PropMeta): ComponentString {
  const opening = opensWithTag(getBlock(content, range))
  if (!opening) return { editable: false, reason: 'ambiguous' }
  if (/(?:^|\s)(?:v-bind(?:\s|=|:\[)|:\[)/.test(opening.attrs))
    return { editable: false, reason: 'dynamic' }
  const attrs = parseAttrs(opening.attrs).filter(attr => sameAttr(attr.name, prop.name))
  if (attrs.length > 1) return { editable: false, reason: 'ambiguous' }
  const attr = attrs[0]
  if (!attr) {
    const value = literal(prop.defaultLiteral)
    return value === null ? { editable: false, reason: 'unknown-default' } : { editable: true, value, explicit: false }
  }
  if (attr.value === null) return { editable: false, reason: 'dynamic' }
  const value = attr.bound ? literal(decode(attr.value)) : decode(attr.value)
  return value === null ? { editable: false, reason: 'dynamic' } : { editable: true, value, explicit: true }
}

export function writeComponentString(content: string, range: SourceRange, prop: PropMeta, value: string): string {
  const previous = readComponentString(content, range, prop)
  if (!previous.editable || previous.value === value) return content
  const encoded = JSON.stringify(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  return replaceBlock(content, range, writeAttr(getBlock(content, range), prop.name, encoded, { bound: true }))
}
