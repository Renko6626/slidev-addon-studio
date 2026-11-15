/** Geometry shared by the presentation component and editor. No editor state. */
export type ShapeKind = 'rect' | 'ellipse' | 'triangle' | 'diamond' | 'hexagon' | 'line' | 'arrow'
export type ShapePreset = ShapeKind | 'roundRect' | 'lineArrow' | 'doubleArrow'
export const shapePresets: ShapePreset[] = ['rect', 'roundRect', 'ellipse', 'triangle', 'diamond', 'hexagon', 'line', 'lineArrow', 'doubleArrow', 'arrow']
export interface ShapeOptions {
  kind: ShapeKind
  fill: string
  stroke: string
  strokeWidth: number
  dash: 'solid' | 'dashed' | 'dotted'
  radius: number
  head: number
  shaft: number
  startArrow: boolean
  endArrow: boolean
}
export interface Point { x: number, y: number }
export interface ShapeBox { x: number, y: number, w: number, h: number, rotate: number }
export type ShapeHandle = 'start' | 'end' | 'radius' | 'head' | 'shaft'
const kinds: ShapeKind[] = ['rect', 'ellipse', 'triangle', 'diamond', 'hexagon', 'line', 'arrow']
export const bound = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value))
function number(value: unknown, fallback: number, min: number, max: number) {
  const n = Number(value)
  return value != null && Number.isFinite(n) ? bound(n, min, max) : fallback
}
export function normalizeShape(input: Partial<ShapeOptions> = {}): ShapeOptions {
  return {
    kind: kinds.includes(input.kind!) ? input.kind! : 'rect',
    fill: input.fill || '#DBEAFE', stroke: input.stroke || '#2563EB',
    strokeWidth: number(input.strokeWidth, 2, 0, 40),
    dash: input.dash === 'dashed' || input.dash === 'dotted' ? input.dash : 'solid',
    radius: number(input.radius, 0, 0, 1000), head: number(input.head, 0.3, 0.1, 0.8),
    shaft: number(input.shaft, 0.4, 0.1, 0.9),
    startArrow: input.startArrow === true, endArrow: input.endArrow === true,
  }
}
export function presetShape(preset: ShapePreset): ShapeOptions {
  return normalizeShape({
    kind: preset === 'roundRect' ? 'rect' : preset === 'lineArrow' || preset === 'doubleArrow' ? 'line' : preset,
    radius: preset === 'roundRect' ? 16 : 0,
    startArrow: preset === 'doubleArrow', endArrow: preset === 'lineArrow' || preset === 'doubleArrow',
  })
}
export function shapePath(shape: ShapeOptions, width: number, height: number): string {
  const w = Math.max(1, width), h = Math.max(1, height)
  const inset = Math.min(shape.strokeWidth / 2, w / 2, h / 2)
  const x = inset, y = inset, right = w - inset, bottom = h - inset
  const polygon = (points: Point[]) => points.map((p, i) => `${i ? 'L' : 'M'} ${p.x} ${p.y}`).join(' ') + ' Z'
  switch (shape.kind) {
    case 'line': return `M 0 ${h / 2} L ${w} ${h / 2}`
    case 'ellipse': return `M ${x} ${h / 2} A ${(w - 2 * x) / 2} ${(h - 2 * y) / 2} 0 1 0 ${right} ${h / 2} A ${(w - 2 * x) / 2} ${(h - 2 * y) / 2} 0 1 0 ${x} ${h / 2} Z`
    case 'triangle': return polygon([{ x: w / 2, y }, { x: right, y: bottom }, { x, y: bottom }])
    case 'diamond': return polygon([{ x: w / 2, y }, { x: right, y: h / 2 }, { x: w / 2, y: bottom }, { x, y: h / 2 }])
    case 'hexagon': return polygon([{ x: w / 4, y }, { x: w * 3 / 4, y }, { x: right, y: h / 2 }, { x: w * 3 / 4, y: bottom }, { x: w / 4, y: bottom }, { x, y: h / 2 }])
    case 'arrow': {
      const neck = w * (1 - shape.head), top = h * (1 - shape.shaft) / 2
      return polygon([{ x, y: top }, { x: neck, y: top }, { x: neck, y }, { x: right, y: h / 2 }, { x: neck, y: bottom }, { x: neck, y: h - top }, { x, y: h - top }])
    }
    default: {
      const r = Math.min(shape.radius, (w - 2 * x) / 2, (h - 2 * y) / 2)
      if (!r) return `M ${x} ${y} H ${right} V ${bottom} H ${x} Z`
      return `M ${x + r} ${y} H ${right - r} A ${r} ${r} 0 0 1 ${right} ${y + r} V ${bottom - r} A ${r} ${r} 0 0 1 ${right - r} ${bottom} H ${x + r} A ${r} ${r} 0 0 1 ${x} ${bottom - r} V ${y + r} A ${r} ${r} 0 0 1 ${x + r} ${y} Z`
    }
  }
}
export function arrowHeadPath(width: number, height: number, strokeWidth: number, start: boolean): string {
  const size = Math.min(width / 3, Math.max(8, strokeWidth * 4))
  const tip = start ? 0 : width, back = start ? size : width - size
  return `M ${tip} ${height / 2} L ${back} ${height / 2 - size / 2} L ${back} ${height / 2 + size / 2} Z`
}
export function dashArray(shape: ShapeOptions): string | undefined {
  const width = Math.max(1, shape.strokeWidth)
  return shape.dash === 'dashed' ? `${width * 4} ${width * 3}` : shape.dash === 'dotted' ? `0 ${width * 3}` : undefined
}
export function lineFromPoints(a: Point, b: Point, snapAngle = false): ShapeBox {
  let angle = Math.atan2(b.y - a.y, b.x - a.x)
  const length = Math.max(1, Math.hypot(b.x - a.x, b.y - a.y))
  if (snapAngle) angle = Math.round(angle / (Math.PI / 4)) * Math.PI / 4
  const end = { x: a.x + length * Math.cos(angle), y: a.y + length * Math.sin(angle) }
  return { x: (a.x + end.x) / 2 - length / 2, y: (a.y + end.y) / 2 - 8, w: length, h: 16, rotate: angle * 180 / Math.PI }
}
export function lineEndpoints(box: ShapeBox): [Point, Point] {
  const angle = box.rotate * Math.PI / 180
  const dx = Math.cos(angle) * box.w / 2, dy = Math.sin(angle) * box.w / 2
  const cx = box.x + box.w / 2, cy = box.y + box.h / 2
  return [{ x: cx - dx, y: cy - dy }, { x: cx + dx, y: cy + dy }]
}
export function localPoint(point: Point, box: ShapeBox): Point {
  const a = -box.rotate * Math.PI / 180
  const dx = point.x - box.x - box.w / 2, dy = point.y - box.y - box.h / 2
  return { x: dx * Math.cos(a) - dy * Math.sin(a) + box.w / 2, y: dx * Math.sin(a) + dy * Math.cos(a) + box.h / 2 }
}
export function shapeHandles(shape: ShapeOptions, w: number, h: number): { id: ShapeHandle, x: number, y: number }[] {
  if (shape.kind === 'line') return [{ id: 'start', x: 0, y: h / 2 }, { id: 'end', x: w, y: h / 2 }]
  if (shape.kind === 'rect') return [{ id: 'radius', x: Math.min(shape.radius, w / 2, h / 2), y: Math.min(14, h / 4) }]
  if (shape.kind === 'arrow') return [{ id: 'head', x: w * (1 - shape.head), y: Math.min(14, h / 4) }, { id: 'shaft', x: Math.min(14, w / 4), y: h * (1 - shape.shaft) / 2 }]
  return []
}
export function adjustShape(shape: ShapeOptions, handle: ShapeHandle, p: Point, w: number, h: number): Partial<ShapeOptions> {
  if (handle === 'radius') return { radius: Math.round(bound(p.x, 0, Math.min(w, h) / 2)) }
  if (handle === 'head') return { head: bound(1 - p.x / w, 0.1, 0.8) }
  if (handle === 'shaft') return { shaft: bound(1 - 2 * p.y / h, 0.1, 0.9) }
  return {}
}
/** Resizing in the local frame moves the centre in the rotated world frame. */
export function resizeShapeBox(box: Omit<ShapeBox, 'rotate'>, handle: string, dx: number, dy: number, rotate: number, keepRatio: boolean) {
  let w = Math.max(16, box.w + (handle.includes('w') ? -dx : handle.includes('e') ? dx : 0))
  let h = Math.max(16, box.h + (handle.includes('n') ? -dy : handle.includes('s') ? dy : 0))
  if (keepRatio) {
    const ratio = box.w / box.h
    if (handle === 'n' || handle === 's') w = Math.max(16, h * ratio)
    else h = Math.max(16, w / ratio)
    w = h * ratio
  }
  const cx = (handle.includes('w') ? -(w - box.w) : handle.includes('e') ? w - box.w : 0) / 2
  const cy = (handle.includes('n') ? -(h - box.h) : handle.includes('s') ? h - box.h : 0) / 2
  const a = rotate * Math.PI / 180
  return { x: box.x + box.w / 2 + cx * Math.cos(a) - cy * Math.sin(a) - w / 2,
    y: box.y + box.h / 2 + cx * Math.sin(a) + cy * Math.cos(a) - h / 2, w, h }
}
