import { afterEach, describe, expect, it, vi } from 'vitest'
import { effectScope } from 'vue'
import type { StudioContext } from '../client/context'
import { useObjectClipboard } from '../client/composables/useObjectClipboard'
import { OBJECT_CLIPBOARD_TYPE } from '../client/md/clipboard'
import { getBlock } from '../client/md/lines'
import { busy, editing, selection, studioOpen } from '../client/state'

const deck = 'http://localhost:3071/edit/deck/'
const source = '<img v-drag="[10,20,100,80]" src="/photo.png" />'

// A native-event seam only: all copy/parse/insert/selection logic is production code.
function clipboard(type: 'copy' | 'paste', values = new Map<string, string>()) {
  const event = new Event(type, { cancelable: true })
  Object.defineProperty(event, 'clipboardData', { value: {
    setData: (key: string, value: string) => values.set(key, value),
    getData: (key: string) => values.get(key) ?? '',
  } })
  return { event, values }
}

let scope = effectScope()
afterEach(() => {
  scope.stop()
  editing.value = false
  studioOpen.value = false
  selection.value = null
  busy.value = false
  vi.unstubAllGlobals()
})

function setup() {
  const document = new EventTarget()
  vi.stubGlobal('document', document)
  studioOpen.value = true
  let content = source
  let no = 1
  let ready = true
  let selected = ''
  const studio = {
    no: () => no, content: () => content, sourceReady: () => ready,
    commit: async (next: string) => { content = next },
    selectInserted: async (_tag: string | undefined, range: [number, number]) => { selected = getBlock(content, range); return true },
  } as unknown as StudioContext
  scope = effectScope()
  scope.run(() => useObjectClipboard(studio, deck))
  selection.value = { el: {} as HTMLElement, no: 1, range: [0, 1], kind: 'html', tag: 'img', positioned: true, nested: false, label: 'Image' }
  return { document, content: () => content, selected: () => selected,
    page: (value: number) => { no = value; content = '# Destination'; selection.value = null },
    ready: (value: boolean) => { ready = value },
  }
}

describe('object clipboard events', () => {
  it('copies then pastes across a page without a selection, selecting each new object', async () => {
    const app = setup()
    const copy = clipboard('copy')
    app.document.dispatchEvent(copy.event)
    expect(copy.event.defaultPrevented).toBe(true)
    expect(copy.values.get('text/plain')).toBe(source)
    expect(copy.values.has(OBJECT_CLIPBOARD_TYPE)).toBe(true)
    app.page(2)
    app.document.dispatchEvent(clipboard('paste', copy.values).event)
    await Promise.resolve()
    await Promise.resolve()
    expect(app.selected()).toBe(source)
    app.document.dispatchEvent(clipboard('paste', copy.values).event)
    await Promise.resolve()
    await Promise.resolve()
    expect(app.selected()).toBe(source.replace('[10,20,', '[30,40,'))
  })

  it('leaves text editing and ordinary external text to the browser', () => {
    const app = setup()
    editing.value = true
    const copy = clipboard('copy')
    app.document.dispatchEvent(copy.event)
    expect(copy.event.defaultPrevented).toBe(false)
    expect(copy.values.size).toBe(0)
    editing.value = false
    const paste = clipboard('paste', new Map([['text/plain', 'External text']]))
    app.document.dispatchEvent(paste.event)
    expect(paste.event.defaultPrevented).toBe(false)
    expect(app.content()).toBe(source)
  })

  it('does not replace an unread destination with just the pasted object', () => {
    const app = setup()
    const copy = clipboard('copy')
    app.document.dispatchEvent(copy.event)
    app.page(2)
    app.ready(false)
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    app.document.dispatchEvent(clipboard('paste', copy.values).event)
    expect(app.content()).toBe('# Destination')
    expect(app.selected()).toBe('')
    log.mockRestore()
  })

  it('does not copy a nested Markdown sublist as a standalone object', () => {
    const app = setup()
    selection.value = {
      ...selection.value!, kind: 'list', tag: undefined, nested: false,
      // Markdown sublists have a list-item ancestor, but no raw-HTML nested flag.
      el: { parentElement: { closest: () => ({ tagName: 'LI' }) } } as unknown as HTMLElement,
    }
    const copy = clipboard('copy')
    app.document.dispatchEvent(copy.event)
    expect(copy.event.defaultPrevented).toBe(false)
    expect(copy.values.size).toBe(0)
  })
})
