import { effectScope, nextTick, ref } from 'vue'
import { afterEach, expect, it, vi } from 'vitest'
import { tagSignature } from '../shared/signature'

vi.mock('@slidev/client/logic/contextMenu.ts', () => ({ openContextMenu: () => {} }))
// Only the slide host is substituted; selection, source lookup and gestures are real.
const host = vi.hoisted(() => ({ elements: [] as any[] }))
vi.mock('../client/dom', () => ({
  belongsToSlide: (el: unknown) => host.elements.includes(el),
  mappedElements: () => host.elements,
  slideElement: () => ({}),
  elementRoot: (el: unknown) => el,
}))

import { useSelection } from '../client/composables/useSelection'
import { useTransformGizmo } from '../client/composables/useTransformGizmo'
import { busy, editing, selection, snapEnabled, studioOpen } from '../client/state'

class SlideElement extends EventTarget {
  tagName: string
  style: Record<string, string> = {}
  dataset: Record<string, string>
  constructor(line: number, source: string) {
    super()
    const tag = source.match(/^<(\w+)/)![1]
    this.tagName = tag.toUpperCase()
    this.dataset = { studioSrc: `${line},${line + 1}`, studioKind: 'html', studioTag: tag, studioSig: tagSignature(source.slice(0, source.indexOf('>') + 1)) }
  }
  closest(selector: string) { return selector.includes('[data-studio-src]') ? this : null }
  contains(el: unknown) { return el === this }
  getAttribute() { return '' }
  setAttribute() {}
}

const a = '<img v-drag="[10,20,100,80]" src="/a.png" />'
const b = '<img v-drag="[10,20,100,80]" src="/b.png" />'
let scope = effectScope()
afterEach(() => {
  scope.stop()
  vi.useRealTimers()
  vi.unstubAllGlobals()
  selection.value = null
  editing.value = false
  busy.value = false
  studioOpen.value = false
  snapEnabled.value = true
})

function setup(firstSource = a) {
  let content = `${firstSource}\n\n${b}`
  const first = new SlideElement(0, firstSource)
  const second = new SlideElement(2, b)
  host.elements = [first, second]
  const document = Object.assign(new EventTarget(), {
    activeElement: null,
    contains: (el: unknown) => host.elements.includes(el),
    elementsFromPoint: () => [selection.value?.el],
    body: {},
  })
  const window = new EventTarget()
  vi.stubGlobal('document', document)
  vi.stubGlobal('window', window)
  vi.stubGlobal('Element', SlideElement)
  vi.stubGlobal('HTMLElement', SlideElement)
  vi.stubGlobal('MutationObserver', class { observe() {} disconnect() {} })
  vi.stubGlobal('getComputedStyle', () => ({ pointerEvents: 'auto', visibility: 'visible', opacity: '1' }))
  studioOpen.value = true
  snapEnabled.value = false
  scope = effectScope()
  let writes = 0
  let gizmo: ReturnType<typeof useTransformGizmo>
  const select = scope.run(() => useSelection(() => 1, () => content, undefined, event => gizmo.startMove(event)))!
  gizmo = scope.run(() => useTransformGizmo({
    canvas: {
      scale: ref(1), slideWidth: ref(960), slideHeight: ref(540),
      rect: ref({ left: 0, top: 0, width: 960, height: 540 }),
      boxOf: () => ({ x: 10, y: 20, w: 100, h: 80 }), originOf: () => ({ x: 0, y: 0 }),
    } as any,
    getTarget: () => selection.value, getContent: () => content, getNo: () => 1,
    commit: async (next) => { content = next; writes++ },
    selectThrough: select.selectThrough,
    onDoubleClick: event => select.editOnPointer(event),
  }))!
  function pointer(type: string, el = first, x = 30, y = 40) {
    const event = new Event(type, { cancelable: true })
    Object.defineProperties(event, {
      target: { value: el }, button: { value: 0 },
      clientX: { value: x }, clientY: { value: y },
    })
    ;(type === 'pointerdown' ? document : window).dispatchEvent(event)
  }
  return { first, second, select, gizmo, pointer, content: () => content, writes: () => writes, setContent: (next: string) => { content = next } }
}

it('moves an unselected object on its first press and writes once on release', async () => {
  const s = setup()
  s.pointer('pointerdown')
  s.pointer('pointermove', s.first, 70, 60)
  expect(s.first.style.left).toBe('50px')
  expect(s.writes()).toBe(0)
  s.pointer('pointerup')
  await nextTick()
  expect(s.content()).toContain('v-drag="[50,40,100,80]"')
  expect(s.writes()).toBe(1)
})

it('selects on a light click without changing the source', () => {
  const s = setup()
  s.pointer('pointerdown')
  s.pointer('pointermove', s.first, 31, 41)
  s.pointer('pointerup')
  expect(selection.value?.el).toBe(s.first)
  expect(s.content()).toBe(`${a}\n\n${b}`)
  expect(s.writes()).toBe(0)
})

it('does not swallow a quick drag of another object near the previous click', () => {
  const s = setup()
  s.pointer('pointerdown')
  s.pointer('pointerup')
  s.pointer('pointerdown', s.second)
  s.pointer('pointermove', s.second, 70, 60)
  s.pointer('pointerup', s.second)
  expect(s.writes()).toBe(1)
  expect(s.second.style.left).toBe('50px')
  expect(s.content().split('\n')[0]).toBe(a)
})

it('allows consecutive drags from the same position instead of treating them as double clicks', () => {
  const s = setup()
  for (let i = 0; i < 2; i++) {
    s.pointer('pointerdown')
    s.pointer('pointermove', s.first, 70 + i * 10, 60)
    s.pointer('pointerup')
  }
  expect(s.writes()).toBe(2)
})

it('hands a second click on the same text object to inline editing without moving it', () => {
  const s = setup('<div data-studio-element="text" v-drag="[10,20,100,80]">Hello</div>')
  s.pointer('pointerdown')
  s.pointer('pointerup')
  s.pointer('pointerdown')
  expect(editing.value).toBe(true)
  expect(s.writes()).toBe(0)
})

it.each(['other object', 'blank'] as const)('does not let an older reselect overwrite a later choice: %s', async (choice) => {
  const s = setup()
  s.select.select(s.first)
  const original = selection.value!
  const pending = s.select.reselect(original.range, original.kind, original.tag)
  if (choice === 'blank') selection.value = null
  else s.select.select(s.second)
  const chosen = selection.value
  await pending
  expect(selection.value).toBe(chosen)
})

it('keeps the same object after a preceding edit shifts its source lines', async () => {
  const s = setup()
  s.select.select(s.second)
  const chosen = selection.value!
  s.setContent(`intro\n\n${a}\n\n${b}`)
  host.elements = [new SlideElement(2, a), new SlideElement(4, b)]
  await s.select.reselect(chosen.range, chosen.kind, chosen.tag)
  expect(selection.value?.el).toBe(host.elements[1])
  expect(selection.value?.range).toEqual([4, 5])
})

it.each(['reselect', 'selectInserted'] as const)('stops %s waiting for rendering when the user selects another object', async (method) => {
  vi.useFakeTimers()
  const s = setup()
  s.select.select(s.first)
  const original = selection.value!
  host.elements = []
  const pending = method === 'reselect'
    ? s.select.reselect(original.range, original.kind, original.tag)
    : s.select.selectInserted(original.tag, original.range!)
  await nextTick()
  host.elements = [s.first, s.second]
  s.select.select(s.second)
  const chosen = selection.value
  await vi.advanceTimersByTimeAsync(40)
  await pending
  expect(selection.value).toBe(chosen)
})

it('restores a shape rotation when Escape cancels the gesture', () => {
  const s = setup('<StudioShape kind="rect" v-drag="[10,20,100,80,30]" />')
  s.select.select(s.first)
  const press = new Event('pointerdown', { cancelable: true })
  Object.defineProperties(press, { button: { value: 0 }, clientX: { value: 60 }, clientY: { value: 0 } })
  s.gizmo.startRotate(press as PointerEvent)
  s.pointer('pointermove', s.first, 160, 60)
  expect(s.first.style.transform).toBe('rotate(90deg)')
  const escape = new Event('keydown', { cancelable: true })
  Object.defineProperty(escape, 'key', { value: 'Escape' })
  window.dispatchEvent(escape)
  expect(s.first.style.transform).toBe('rotate(30deg)')
  expect(s.writes()).toBe(0)
})
