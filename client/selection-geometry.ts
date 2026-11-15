import type { Box } from './composables/useSnapping'

export type Align = 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom'

export function boundsOf(boxes: Box[]): Box {
  const x = Math.min(...boxes.map(box => box.x))
  const y = Math.min(...boxes.map(box => box.y))
  return { x, y, w: Math.max(...boxes.map(box => box.x + box.w)) - x, h: Math.max(...boxes.map(box => box.y + box.h)) - y }
}

/** Returned deltas move whole objects, preserving dimensions and rotation. */
export function alignDeltas(boxes: Box[], alignment: Align) {
  const bounds = boundsOf(boxes)
  return boxes.map(box => ({
    x: alignment === 'left' ? bounds.x - box.x
      : alignment === 'right' ? bounds.x + bounds.w - box.x - box.w
        : alignment === 'center' ? bounds.x + bounds.w / 2 - box.x - box.w / 2 : 0,
    y: alignment === 'top' ? bounds.y - box.y
      : alignment === 'bottom' ? bounds.y + bounds.h - box.y - box.h
        : alignment === 'middle' ? bounds.y + bounds.h / 2 - box.y - box.h / 2 : 0,
  }))
}

/** Keep the outer two objects fixed and equalise the visible gaps. */
export function distributeDeltas(boxes: Box[], axis: 'x' | 'y') {
  const deltas = boxes.map(() => ({ x: 0, y: 0 }))
  if (boxes.length < 3) return deltas
  const size = axis === 'x' ? 'w' : 'h'
  const sorted = boxes.map((box, index) => ({ box, index })).sort((a, b) => a.box[axis] - b.box[axis])
  const first = sorted[0].box, last = sorted.at(-1)!.box
  const gap = (last[axis] + last[size] - first[axis] - boxes.reduce((sum, box) => sum + box[size], 0)) / (boxes.length - 1)
  let position = first[axis]
  for (const { box, index } of sorted) {
    deltas[index][axis] = position - box[axis]
    position += box[size] + gap
  }
  return deltas
}
