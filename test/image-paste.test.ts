// @vitest-environment jsdom
import { effectScope, ref } from 'vue'
import { afterEach, expect, it, vi } from 'vitest'
import type { StudioContext } from '../client/context'
import { useObjectClipboard } from '../client/composables/useObjectClipboard'
import { imagePending } from '../client/composables/useImageInsertion'
import { busy, editing, ribbonTab, selection, studioOpen } from '../client/state'
import { readElement } from '../client/md/elements'

let scope = effectScope()
afterEach(() => {
  scope.stop()
  document.body.replaceChildren()
  studioOpen.value = false
  editing.value = false
  busy.value = false
  imagePending.value = false
  selection.value = null
  ribbonTab.value = 'home'
  vi.unstubAllGlobals()
})

function setup() {
  studioOpen.value = true
  let source = '# Keep this title'
  let selected: [number, number] | undefined
  const studio = {
    no: () => 1, content: () => source, sourceReady: () => true,
    canvas: { slideWidth: ref(1000), slideHeight: ref(600) },
    commit: async (next: string) => { source = next },
    selectInserted: async (_tag: string, range: [number, number]) => { selected = range; return true },
  } as unknown as StudioContext
  scope = effectScope()
  scope.run(() => useObjectClipboard(studio, 'http://localhost/'))
  return { source: () => source, selected: () => selected }
}

function pasteImage(target: EventTarget, name = 'image') {
  const event = new Event('paste', { bubbles: true, cancelable: true })
  Object.defineProperty(event, 'clipboardData', { value: {
    getData: () => '',
    files: [new File(['screenshot'], name, { type: 'image/png' })],
  } })
  target.dispatchEvent(event)
  return event
}

it('uploads a pasted screenshot as a local image and inserts a selected editable object', async () => {
  const app = setup()
  let uploaded: { name: string, data: string } | undefined
  vi.stubGlobal('fetch', async (_url: string, init: RequestInit) => {
    uploaded = JSON.parse(init.body as string)
    return { ok: true, json: async () => ({ name: 'pasted-image.png', url: '/pasted-image.png', kind: 'image', size: 10 }) }
  })
  vi.stubGlobal('Image', class {
    naturalWidth = 400; naturalHeight = 200
    onload: (() => void) | null = null
    set src(_value: string) { queueMicrotask(() => this.onload?.()) }
  })
  const event = pasteImage(document)
  expect(event.defaultPrevented).toBe(true)
  await vi.waitFor(() => expect(app.selected()).toBeDefined())
  expect(uploaded).toEqual({ name: 'pasted-image.png', data: 'data:image/png;base64,c2NyZWVuc2hvdA==' })
  expect(app.source()).toContain('# Keep this title')
  expect(readElement(app.source(), app.selected()!)).toMatchObject({ kind: 'image', src: '/pasted-image.png', lockRatio: true })
  expect(imagePending.value).toBe(false)
})

it('leaves image paste in an input or an active text edit to the browser', () => {
  const app = setup()
  const input = document.createElement('input')
  document.body.append(input)
  input.focus()
  expect(pasteImage(input).defaultPrevented).toBe(false)
  input.blur()
  editing.value = true
  expect(pasteImage(document).defaultPrevented).toBe(false)
  expect(app.source()).toBe('# Keep this title')
})
