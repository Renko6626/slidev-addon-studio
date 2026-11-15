import { expect, it } from 'vitest'
import { lineFromPoints, lineEndpoints, shapePath, normalizeShape, adjustShape, resizeShapeBox } from '../shared/shapes'
import { createShape, readShape, patchShape } from '../client/md/shapes'
import { readDrag } from '../client/md/drag'

it('keeps both endpoints when representing horizontal, vertical and reversed lines', () => {
  for (const [a, b] of [[{ x: 20, y: 30 }, { x: 200, y: 30 }], [{ x: 20, y: 30 }, { x: 20, y: 160 }], [{ x: 80, y: 90 }, { x: -20, y: -30 }]]) {
    const ends = lineEndpoints(lineFromPoints(a, b))
    expect(ends[0].x).toBeCloseTo(a.x)
    expect(ends[0].y).toBeCloseTo(a.y)
    expect(ends[1].x).toBeCloseTo(b.x)
    expect(ends[1].y).toBeCloseTo(b.y)
  }
})

it('adjusts only a shape parameter, constrained by its current dimensions', () => {
  const rect = normalizeShape({ kind: 'rect', radius: 10 })
  expect(adjustShape(rect, 'radius', { x: 500, y: 0 }, 120, 80)).toEqual({ radius: 40 })
  const arrow = normalizeShape({ kind: 'arrow' })
  expect(adjustShape(arrow, 'head', { x: 150, y: 0 }, 200, 100)).toEqual({ head: 0.25 })
  expect(shapePath(rect, 120, 80)).toContain('A 10 10')
})

it('keeps the opposite corner fixed while resizing a rotated shape', () => {
  const box = { x: 10, y: 20, w: 100, h: 80 }
  const next = resizeShapeBox(box, 'se', 20, 40, 90, false)
  expect(next).toMatchObject({ x: -20, y: 10, w: 120, h: 120 })
})

it('writes readable component props and preserves unrelated source and position', () => {
  const snippet = createShape('roundRect', { x: 20, y: 30, w: 240, h: 160, rotate: 0 })
  const source = '# Title\n\n' + snippet + '\n\nEnd'
  expect(readShape(source, [2, 3])).toMatchObject({ kind: 'rect', radius: 16 })
  const next = patchShape(source, [2, 3], { fill: 'var(--accent)', strokeWidth: 4, dash: 'dashed' })
  expect(next).toContain('fill="var(--accent)"')
  expect(readShape(next, [2, 3])).toMatchObject({ strokeWidth: 4, dash: 'dashed' })
  expect(readDrag(next, [2, 3])).toEqual(readDrag(source, [2, 3]))
  expect(next.startsWith('# Title\n\n')).toBe(true)
  expect(next.endsWith('\n\nEnd')).toBe(true)
})
