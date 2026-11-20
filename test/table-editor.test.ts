// @vitest-environment jsdom
import { resolve } from 'node:path'
import { afterEach, expect, it, vi } from 'vitest'
import { createApp, nextTick, ref } from 'vue'
import type { App } from 'vue'
import * as table from '../shared/table'
import * as tableHTML from '../shared/table-html'
import * as i18n from '../client/i18n'
import * as lines from '../client/md/lines'
import * as tableSource from '../client/md/table'
import * as cells from '../client/md/table-cell'
import * as state from '../client/state'
import * as cellText from '../client/table-cell-text'
import * as textEditor from '../client/text/editor'
import { loadVueComponent } from './sfc'

let app: App | undefined
afterEach(() => {
  app?.unmount()
  app = undefined
  state.selection.value = null
  state.ribbonTab.value = 'home'
  document.body.replaceChildren()
  vi.restoreAllMocks()
})

async function session(source: string, beforeCommit?: () => Promise<void>, edit = true) {
  const no = ref(1)
  const content = ref(source)
  const commit = vi.fn(async (next: string) => {
    await beforeCommit?.()
    content.value = next
  })
  const studio = { no: () => no.value, content: () => content.value, commit, canvas: { scale: ref(1) } }
  const component = loadVueComponent(resolve(process.cwd(), 'client/ui/TableEditorLayer.vue'), {
    '@vueuse/core': { useRafFn: () => {} },
    '../../shared/table': table, '../../shared/table-html': tableHTML,
    '../context': { useStudio: () => studio }, '../i18n': i18n,
    '../md/lines': lines, '../md/table': tableSource, '../md/table-cell': cells,
    '../state': state, '../table-cell-text': cellText, '../text/editor': textEditor,
  })
  const root = document.createElement('div')
  root.innerHTML = '<table><tbody><tr><td data-studio-table-cell="0,0"></td></tr></tbody></table>'
  root.dataset.studioTable = ''
  const host = document.createElement('div')
  document.body.append(root, host)
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 100, 24))
  app = createApp(component)
  const layer = app.mount(host) as unknown as { apply: () => Promise<void> }
  state.selection.value = { el: root, no: 1, tag: 'StudioTable', range: [0, 1], kind: 'component', positioned: false, nested: false, label: 'Table' }
  if (edit)
    state.tableEditRequest.value = { row: 0, column: 0 }
  await nextTick()
  return { root, host, layer, no, content, commit }
}

it('appends a row with Tab without reserializing the untouched rich cell', async () => {
  const s = await session(`<StudioTable :header="false" rich :rows="[['<b>Old</b>']]" />`)
  await vi.waitFor(() => expect(cellText.tableCellEditor.value).not.toBeNull())
  cellText.tableCellEditor.value!.view.dom.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }))
  await vi.waitFor(() => expect(s.commit).toHaveBeenCalledOnce())
  const read = tableSource.readTable(s.content.value, [0, s.content.value.split('\n').length])
  expect(read.table.rows).toEqual([['<b>Old</b>'], ['']])
  await vi.waitFor(() => expect(cellText.tableCellEditor.value).toBeNull())
  s.root.querySelector('tbody')!.insertAdjacentHTML('beforeend', '<tr><td data-studio-table-cell="1,0"></td></tr>')
  await vi.waitFor(() => expect(cellText.tableCellEditor.value?.getText()).toBe(''))
})

it('never applies an open cell draft to a replacement slide', async () => {
  const s = await session(`<StudioTable :header="false" :rows="[['First slide']]" />`)
  await vi.waitFor(() => expect(s.host.querySelector('textarea')).not.toBeNull())
  const input = s.host.querySelector('textarea')!
  input.value = 'Edited first slide'
  input.dispatchEvent(new Event('input', { bubbles: true }))
  const other = `<StudioTable :header="false" :rows="[['Another slide']]" />`
  s.no.value = 2
  s.content.value = other
  await s.layer.apply()
  expect(s.commit).not.toHaveBeenCalled()
  expect(s.content.value).toBe(other)
})

it('waits for an in-flight Tab write when the document is saved', async () => {
  let finishWrite!: () => void
  const writing = new Promise<void>(resolve => { finishWrite = resolve })
  const s = await session(`<StudioTable :header="false" :rows="[['Old']]" />`, () => writing)
  await vi.waitFor(() => expect(s.host.querySelector('textarea')).not.toBeNull())
  const input = s.host.querySelector('textarea')!
  input.value = 'Edited'
  input.dispatchEvent(new Event('input', { bubbles: true }))
  input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }))
  expect(s.commit).toHaveBeenCalledOnce()
  const saving = s.layer.apply()
  finishWrite()
  await saving
  expect(s.commit).toHaveBeenCalledOnce()
  expect(tableSource.readTable(s.content.value, [0, s.content.value.split('\n').length]).table.rows).toEqual([['Edited'], ['']])
  expect(state.tableEditing.value).toBe(false)
})

it('extends with Shift-click and selects from the starting cell during Shift-drag', async () => {
  const s = await session(`<StudioTable :columns="[{ label: 'A' }, { label: 'B' }]" :rows="[['a', 'b']]" />`, undefined, false)
  s.root.innerHTML = '<table><thead><tr><th data-studio-table-cell="-1,0"></th><th data-studio-table-cell="-1,1"></th></tr></thead><tbody><tr><td data-studio-table-cell="0,0"></td><td data-studio-table-cell="0,1"></td></tr></tbody></table>'
  const [header, nextHeader, first, second] = s.root.querySelectorAll('[data-studio-table-cell]')
  const pointer = (target: EventTarget, name: string, shiftKey = false) => {
    const event = new MouseEvent(name, { shiftKey, bubbles: true, cancelable: true, button: 0 })
    Object.defineProperty(event, 'pointerId', { value: 1 })
    target.dispatchEvent(event)
    return event
  }

  pointer(header, 'pointerdown')
  expect(pointer(second, 'pointerdown', true).defaultPrevented).toBe(true)
  pointer(second, 'pointerup', true)
  expect(state.tableRange.value).toEqual({ rowStart: -1, rowEnd: 0, columnStart: 0, columnEnd: 1 })

  const moveSurface = document.createElement('div')
  moveSurface.className = 'studio-move'
  s.host.append(moveSurface)
  const previous = Object.getOwnPropertyDescriptor(document, 'elementsFromPoint')
  let pointedCell = first
  Object.defineProperty(document, 'elementsFromPoint', { configurable: true, value: () => [moveSurface, pointedCell] })
  try {
    expect(pointer(moveSurface, 'pointerdown', true).defaultPrevented).toBe(true)
    pointedCell = nextHeader
    pointer(moveSurface, 'pointermove', true)
    pointer(moveSurface, 'pointerup', true)
    pointer(moveSurface, 'click')
  }
  finally {
    if (previous)
      Object.defineProperty(document, 'elementsFromPoint', previous)
    else
      Reflect.deleteProperty(document, 'elementsFromPoint')
  }
  expect(state.tableCell.value).toEqual({ row: 0, column: 0 })
  expect(state.tableRange.value).toEqual({ rowStart: -1, rowEnd: 0, columnStart: 0, columnEnd: 1 })
  expect(s.commit).not.toHaveBeenCalled()
})
