// @vitest-environment jsdom
import { effectScope, ref } from 'vue'
import { afterEach, expect, it } from 'vitest'
import { useShapeTools } from '../client/composables/useShapeTools'
import { createShape, readShape } from '../client/md/shapes'
import { readDrag } from '../client/md/drag'
import { lineEndpoints } from '../shared/shapes'
import { editing, selection, studioOpen, busy } from '../client/state'

const scopes: ReturnType<typeof effectScope>[] = []
afterEach(() => { scopes.splice(0).forEach(s => s.stop()); selection.value = null; studioOpen.value = false; document.body.replaceChildren() })
function pointer(type: string, x: number, y: number) {
  return new MouseEvent(type, { clientX: x, clientY: y, button: 0, bubbles: true }) as PointerEvent
}
function setup(preset: 'roundRect' | 'lineArrow' = 'roundRect') {
  const scope = effectScope(); scopes.push(scope)
  let source = createShape(preset, { x: 20, y: 30, w: 200, h: preset === 'lineArrow' ? 16 : 100, rotate: 0 })
  let commits = 0
  const el = document.createElement('div'); document.body.append(el)
  el.style.cssText = 'left:20px;top:30px;width:200px;height:100px'
  studioOpen.value = true; editing.value = false; busy.value = false
  selection.value = { el, no: 1, range: [0, 1], kind: 'component', tag: 'StudioShape', element: 'shape', positioned: true, nested: false, label: 'Shape' }
  const canvas = { scale: ref(1), toCanvas: (x: number, y: number) => ({ x, y }), originOf: () => ({ x: 0, y: 0 }), boxOf: () => ({ x: 20, y: 30, w: 200, h: preset === 'lineArrow' ? 16 : 100 }) } as any
  const tools = scope.run(() => useShapeTools({ canvas, no: () => 1, content: () => source, sourceReady: () => true, selectInserted: async () => true, commit: async next => { source = next; commits++ } }))!
  return { tools, el, source: () => source, commits: () => commits }
}
it('previews radius while dragging and writes only on release; Escape discards the next gesture', async () => {
  const s = setup()
  let preview: unknown
  s.el.addEventListener('studio-shape-preview', event => { preview = (event as CustomEvent).detail })
  s.tools.startHandle(pointer('pointerdown', 36, 44), 'radius')
  window.dispatchEvent(pointer('pointermove', 60, 30))
  expect(preview).toEqual({ radius: 40 })
  expect(s.commits()).toBe(0)
  window.dispatchEvent(pointer('pointerup', 60, 30))
  expect(readShape(s.source(), [0, 1])?.radius).toBe(40)
  expect(s.commits()).toBe(1)
  s.tools.startHandle(pointer('pointerdown', 60, 44), 'radius')
  window.dispatchEvent(pointer('pointermove', 25, 30))
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
  window.dispatchEvent(pointer('pointerup', 25, 30))
  expect(s.commits()).toBe(1)
  expect(readShape(s.source(), [0, 1])?.radius).toBe(40)
})
it('moves a line endpoint while keeping the other endpoint fixed', () => {
  const s = setup('lineArrow')
  s.tools.startHandle(pointer('pointerdown', 220, 38), 'end')
  window.dispatchEvent(pointer('pointermove', 20, 238))
  expect(s.commits()).toBe(0)
  window.dispatchEvent(pointer('pointerup', 20, 238))
  const pos = readDrag(s.source(), [0, 1])!.pos!
  const [a, b] = lineEndpoints({ ...pos, h: pos.h! })
  expect(a.x).toBeCloseTo(20)
  expect(a.y).toBeCloseTo(38)
  expect(b.x).toBeCloseTo(20)
  expect(b.y).toBeCloseTo(238)
  expect(s.commits()).toBe(1)
})
it('draws a preset and can cancel insertion without a source write', async () => {
  const s = setup()
  s.tools.choose('ellipse')
  s.tools.beginDraw(pointer('pointerdown', 10, 10))
  window.dispatchEvent(pointer('pointermove', 110, 60))
  expect(s.commits()).toBe(0)
  window.dispatchEvent(pointer('pointerup', 110, 60))
  expect(s.source()).toContain('kind="ellipse" v-drag="[10,10,100,50]"')
  expect(s.commits()).toBe(1)
  s.tools.choose('rect')
  s.tools.beginDraw(pointer('pointerdown', 50, 50))
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
  window.dispatchEvent(pointer('pointerup', 100, 100))
  expect(s.commits()).toBe(1)
})
