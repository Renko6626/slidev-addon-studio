import type { StudioTarget } from './types'
import { readDrag } from './md/drag'
import { canWriteLayer, readLayer, writeLayer } from './md/layers'

export type LayerMove = 'forward' | 'backward' | 'front' | 'back'
export interface StudioLayer {
  target: StudioTarget
  rank: number
  orderable: boolean
}

/** Front-to-back inside each parent; separate containers keep their own group. */
export function objectLayers(targets: StudioTarget[], content: string): StudioLayer[][] {
  const groups = new Map<HTMLElement, StudioLayer[]>()
  const objects = targets.filter(target => target.range && target.positioned
    && !target.el.closest('[data-studio-background]')
    && readDrag(content, target.range)?.via === 'attr')
  for (const target of objects) {
    const parent = target.el.parentElement
    if (!parent || !target.range) continue
    const style = getComputedStyle(target.el)
    const z = Number.parseInt(style.zIndex, 10)
    const sameRange = objects.filter(other => other.range?.[0] === target.range![0] && other.range[1] === target.range![1])
    const item = {
      target,
      rank: readLayer(content, target.range) ?? (Number.isFinite(z) ? z : 100),
      orderable: !target.nested && sameRange.length === 1 && style.position === 'absolute' && canWriteLayer(content, target.range),
    }
    const group = groups.get(parent) ?? []
    group.push(item)
    groups.set(parent, group)
  }
  return [...groups.values()].map(group => group.reverse().sort((a, b) => b.rank - a.rank))
}

function movedPeers(group: StudioLayer[], target: StudioTarget, direction: LayerMove): StudioLayer[] | null {
  const peers = group.filter(item => item.orderable && item.target.el.parentElement === target.el.parentElement)
  const index = peers.findIndex(item => item.target.el === target.el)
  if (index < 0) return null
  const next = direction === 'front' ? 0 : direction === 'back' ? peers.length - 1
    : index + (direction === 'forward' ? -1 : 1)
  if (next < 0 || next >= peers.length || next === index) return null
  const [item] = peers.splice(index, 1)
  peers.splice(next, 0, item)
  return peers
}

export function canMoveLayer(group: StudioLayer[], target: StudioTarget, direction: LayerMove): boolean {
  return !!movedPeers(group, target, direction)
}

/** One source update for the entire same-parent group. Never move source lines. */
export function reorderLayers(content: string, group: StudioLayer[], target: StudioTarget, direction: LayerMove): string {
  const peers = movedPeers(group, target, direction)
  if (!peers) return content
  return peers.reduce((next, item, index) => writeLayer(next, item.target.range!, 100 + peers.length - index - 1), content)
}
