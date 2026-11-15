import { normalizeShape, presetShape } from '../../shared/shapes'
import type { ShapeOptions, ShapePreset, ShapeBox } from '../../shared/shapes'
import type { SourceRange } from '../types'
import { getBlock, replaceBlock } from './lines'
import { findAttr, opensWithTag, writeAttr } from './tags'
import { formatPos } from './drag'

const names: Record<keyof ShapeOptions, string> = {
  kind: 'kind', fill: 'fill', stroke: 'stroke', strokeWidth: 'stroke-width', dash: 'dash', radius: 'radius', head: 'head', shaft: 'shaft', startArrow: 'start-arrow', endArrow: 'end-arrow',
}
const numeric = new Set(['strokeWidth', 'radius', 'head', 'shaft'])
export function readShape(content: string, range: SourceRange): ShapeOptions | null {
  const block = getBlock(content, range)
  if (opensWithTag(block)?.name !== 'StudioShape') return null
  const values: Record<string, unknown> = {}
  for (const [key, name] of Object.entries(names)) {
    const attr = findAttr(block, name) ?? findAttr(block, key)
    if (!attr) continue
    const value = (attr.value ?? '').replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
    if (numeric.has(key)) {
      if (!Number.isFinite(Number(value))) return null
      values[key] = Number(value)
    }
    else if (key === 'startArrow' || key === 'endArrow') {
      if (attr.value !== null && !['true', 'false'].includes(value)) return null
      values[key] = attr.value === null || value === 'true'
    }
    else {
      if (attr.bound) return null
      values[key] = value
    }
  }
  return normalizeShape(values)
}
export function patchShape(content: string, range: SourceRange, patch: Partial<ShapeOptions>): string {
  const current = readShape(content, range)
  if (!current) return content
  const next = normalizeShape({ ...current, ...patch })
  let block = getBlock(content, range)
  for (const key of Object.keys(patch) as (keyof ShapeOptions)[]) {
    const name = names[key]
    if (!name) continue
    if (name !== key && findAttr(block, key)) block = writeAttr(block, key, null)
    const value = String(next[key]).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    block = writeAttr(block, name, value, { bound: numeric.has(key) || typeof next[key] === 'boolean' })
  }
  return replaceBlock(content, range, block)
}
export function createShape(preset: ShapePreset, box: ShapeBox): string {
  const shape = presetShape(preset)
  let snippet = `<StudioShape kind="${shape.kind}" v-drag="${formatPos(box, 'attr')}" />`
  const patch: Partial<ShapeOptions> = { fill: shape.fill, stroke: shape.stroke, strokeWidth: shape.strokeWidth }
  if (shape.radius) patch.radius = shape.radius
  if (shape.kind === 'line') { patch.startArrow = shape.startArrow; patch.endArrow = shape.endArrow }
  return patchShape(snippet, [0, 1], patch)
}
