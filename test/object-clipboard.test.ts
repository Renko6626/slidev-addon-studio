import { afterEach, describe, expect, it, vi } from 'vitest'
import { effectScope } from 'vue'
import type { StudioContext } from '../client/context'
import { useObjectClipboard } from '../client/composables/useObjectClipboard'
import { OBJECT_CLIPBOARD_TYPE } from '../client/md/clipboard'
import { endOfBlock, getBlock } from '../client/md/lines'
import { readTable, tableSnippet } from '../client/md/table'
import { busy, editing, lastError, selection, setSelectedTargets, studioOpen, tableCell, tableEditing, tableRange } from '../client/state'
import { findAttr } from '../client/md/tags'
import { readDrag } from '../client/md/drag'
import { TABLE_DEFAULTS } from '../shared/table'

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
  tableEditing.value = false
  studioOpen.value = false
  selection.value = null
  busy.value = false
  lastError.value = null
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
  let multiRanges: [number, number][] = []
  let writes = 0
  const studio = {
    no: () => no, content: () => content, sourceReady: () => ready,
    commit: async (next: string) => { content = next; writes++ },
    selectInsertedMany: async (items: { range: [number, number] }[]) => { multiRanges = items.map(item => item.range); return true },
    selectInserted: async (_tag: string | undefined, range: [number, number]) => { selected = getBlock(content, range); return true },
  } as unknown as StudioContext
  scope = effectScope()
  scope.run(() => useObjectClipboard(studio, deck))
  selection.value = { el: {} as HTMLElement, no: 1, range: [0, 1], kind: 'html', tag: 'img', positioned: true, nested: false, label: 'Image' }
  return { document, content: () => content, selected: () => selected,
    setContent: (next: string) => { content = next }, multiRanges: () => multiRanges, writes: () => writes,
    page: (value: number) => { no = value; content = '# Destination'; selection.value = null },
    ready: (value: boolean) => { ready = value },
  }
}

function selectTable(content: string) {
  const lines = content.split('\n')
  const start = lines.findIndex(line => line.startsWith('<StudioTable'))
  selection.value = { ...selection.value!, kind: 'component', tag: 'StudioTable', range: [start, endOfBlock(lines, start)] }
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

it('copies every selected object using the existing envelope and pastes all in one write', async () => {
  const app = setup()
  const second = '<img v-drag="[200,100,80,60]" src="/second.png" />'
  app.setContent(`${source}\n\n${second}`)
  setSelectedTargets([selection.value!, { ...selection.value!, range: [2, 3] }])
  const copy = clipboard('copy')
  app.document.dispatchEvent(copy.event)
  expect(copy.values.get('text/plain')).toBe(`${source}\n\n${second}`)
  app.document.dispatchEvent(clipboard('paste', copy.values).event)
  await Promise.resolve()
  await Promise.resolve()
  expect(app.writes()).toBe(1)
  expect(app.multiRanges().map(range => getBlock(app.content(), range))).toEqual([
    source.replace('[10,20,', '[30,40,'), second.replace('[200,100,', '[220,120,'),
  ])
})

it('rebinds a copied question group together while leaving standalone button copies linked to the original', async () => {
  const app = setup()
  const snippets = [
    '<StudioQuestion question="q1" title="Choose" v-drag="[10,20,400,80]" />',
    '<StudioButton question="q1" action="choose" option="a" v-drag="[10,120,400,60]" />',
    '<StudioFeedback question="q1" v-drag="[10,220,400,60]" />',
  ]
  app.setContent(snippets.join('\n\n'))
  const targets = snippets.map((_, index) => ({ ...selection.value!, range: [index * 2, index * 2 + 1] as [number, number], kind: 'component' as const, tag: ['StudioQuestion', 'StudioButton', 'StudioFeedback'][index] }))
  setSelectedTargets(targets)
  const group = clipboard('copy')
  app.document.dispatchEvent(group.event)
  app.document.dispatchEvent(clipboard('paste', group.values).event)
  await Promise.resolve()
  await Promise.resolve()
  const inserted = app.multiRanges().map(range => getBlock(app.content(), range))
  const question = findAttr(inserted[0], 'question')?.value
  expect(question).toBeTruthy()
  expect(question).not.toBe('q1')
  expect(inserted.map(block => findAttr(block, 'question')?.value)).toEqual([question, question, question])
  expect(readDrag(app.content(), app.multiRanges()[1])?.pos?.y).toBe(140)
  expect(app.writes()).toBe(1)
  setSelectedTargets([targets[1]])
  const button = clipboard('copy')
  app.document.dispatchEvent(button.event)
  app.document.dispatchEvent(clipboard('paste', button.values).event)
  await Promise.resolve()
  await Promise.resolve()
  expect(findAttr(app.selected(), 'question')?.value).toBe('q1')
  expect(findAttr(app.selected(), 'option')?.value).toBe('a')
})

describe('table clipboard events', () => {
  const table = tableSnippet({ ...TABLE_DEFAULTS, columns: [{ label: 'A', width: 40 }, { label: 'B', align: 'right' }], rows: [['keep', '']], rowHeights: [51] })

  it('copies the selected cells as TSV and falls back to object copy without an explicit cell', () => {
    const app = setup()
    app.setContent(table)
    selectTable(table)

    const objectCopy = clipboard('copy')
    app.document.dispatchEvent(objectCopy.event)
    expect(objectCopy.values.get('text/plain')).toBe(table)
    expect(objectCopy.values.has(OBJECT_CLIPBOARD_TYPE)).toBe(true)

    tableRange.value = { rowStart: -1, rowEnd: 0, columnStart: 0, columnEnd: 1 }
    const cellsCopy = clipboard('copy')
    app.document.dispatchEvent(cellsCopy.event)
    expect(cellsCopy.event.defaultPrevented).toBe(true)
    expect(cellsCopy.values.get('text/plain')).toBe('A\tB\nkeep\t')
    expect(cellsCopy.values.has(OBJECT_CLIPBOARD_TYPE)).toBe(false)
  })

  it('pastes from the upper-left corner, grows the table and commits once', () => {
    const app = setup()
    const original = `# Before\n\n${table.replace('<StudioTable', '<StudioTable v-drag="[10,20,200,100]" class="author" :border="false"')}\n\nAfter`
    app.setContent(original)
    selectTable(original)
    tableCell.value = { row: 0, column: 0 }
    tableRange.value = { rowStart: -1, rowEnd: 0, columnStart: 1, columnEnd: 1 }
    const paste = clipboard('paste', new Map([['text/plain', 'New\t"quoted ""label"""\r\n"with\ttab"\t\r\nnew row\tvalue\r\n']]))
    app.document.dispatchEvent(paste.event)
    expect(paste.event.defaultPrevented).toBe(true)
    expect(app.writes()).toBe(1)
    const next = app.content()
    const { table: data } = readTable(next, [2, endOfBlock(next.split('\n'), 2)])
    expect(data.columns.map(column => column.label)).toEqual(['A', 'New', 'quoted "label"'])
    expect(data.columns[0].width).toBe(40)
    expect(data.columns[1].align).toBe('right')
    expect(data.rows).toEqual([['keep', 'with\ttab', ''], ['', 'new row', 'value']])
    expect(data.rowHeights).toEqual([51, null])
    expect(next).toContain('<StudioTable v-drag="[10,20,200,100]" class="author" :border="false"')
    expect(next.startsWith('# Before\n\n')).toBe(true)
    expect(next.endsWith('\n\nAfter')).toBe(true)
  })

  it('rejects overlap before growing the table and leaves inline editing native', () => {
    const app = setup()
    const mergedTable = table.replace('<StudioTable', '<StudioTable :merges="[{ row: 0, column: 0, colspan: 2 }]"')
    app.setContent(mergedTable)
    selectTable(mergedTable)
    tableCell.value = { row: null, column: 0 }
    const values = new Map([['text/plain', 'a\tb\tc\nx\ty\tz']])
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    const paste = clipboard('paste', values)
    app.document.dispatchEvent(paste.event)
    log.mockRestore()
    expect(paste.event.defaultPrevented).toBe(true)
    expect(lastError.value).toBeTruthy()
    expect(app.content()).toBe(mergedTable)
    expect(app.writes()).toBe(0)

    tableEditing.value = true
    const inlinePaste = clipboard('paste', values)
    const inlineCopy = clipboard('copy')
    app.document.dispatchEvent(inlinePaste.event)
    app.document.dispatchEvent(inlineCopy.event)
    expect(inlinePaste.event.defaultPrevented).toBe(false)
    expect(inlineCopy.event.defaultPrevented).toBe(false)
    expect(app.writes()).toBe(0)
  })

  it('inserts grid text as body rows on a blank canvas but leaves ordinary text native', async () => {
    const app = setup()
    app.page(2)
    for (const text of ['single cell', 'ordinary\nmultiline']) {
      const paste = clipboard('paste', new Map([['text/plain', text]]))
      app.document.dispatchEvent(paste.event)
      expect(paste.event.defaultPrevented).toBe(false)
    }
    expect(app.writes()).toBe(0)

    const paste = clipboard('paste', new Map([['text/plain', 'A\tB\n\t"a\nb"']]))
    app.document.dispatchEvent(paste.event)
    await Promise.resolve()
    const selected = app.selected()
    const { table: inserted } = readTable(selected, [0, selected.split('\n').length])
    expect(paste.event.defaultPrevented).toBe(true)
    expect(app.writes()).toBe(1)
    expect(inserted.header).toBe(false)
    expect(inserted.rows).toEqual([['A', 'B'], ['', 'a\nb']])
  })

  it('round-trips a one-column selection onto a blank canvas using HTML only to identify the grid', async () => {
    const app = setup()
    app.setContent(table)
    selectTable(table)
    tableRange.value = { rowStart: -1, rowEnd: 0, columnStart: 0, columnEnd: 0 }
    const copied = clipboard('copy')
    app.document.dispatchEvent(copied.event)
    expect(copied.values.get('text/plain')).toBe('A\nkeep')
    expect(copied.values.get('text/html')).toBe('<table><tr><td>A</td></tr><tr><td>keep</td></tr></table>')
    app.page(2)
    app.document.dispatchEvent(clipboard('paste', copied.values).event)
    await Promise.resolve()
    const selected = app.selected()
    expect(readTable(selected, [0, selected.split('\n').length]).table.rows).toEqual([['A'], ['keep']])
  })

  it('pastes a grid into a table selected as an object and leaves dynamic tables to source editing', () => {
    const app = setup()
    const empty = '<StudioTable />'
    app.setContent(empty)
    selectTable(empty)
    const values = new Map([['text/plain', 'X\tY']])
    app.document.dispatchEvent(clipboard('paste', values).event)
    expect(app.writes()).toBe(1)
    expect(readTable(app.content(), [0, app.content().split('\n').length]).table.columns.map(column => column.label)).toEqual(['X', 'Y'])

    const dynamic = '<StudioTable :columns="columns" :rows="rows" />'
    app.setContent(dynamic)
    selectTable(dynamic)
    tableCell.value = { row: 0, column: 0 }
    const paste = clipboard('paste', values)
    app.document.dispatchEvent(paste.event)
    expect(paste.event.defaultPrevented).toBe(false)
    expect(app.content()).toBe(dynamic)
    expect(app.writes()).toBe(1)
  })

  it('preserves raw single-cell text in a nested table and gives object data precedence', () => {
    const app = setup()
    const original = clipboard('copy')
    app.document.dispatchEvent(original.event)
    const nested = `<div>\n${table.split('\n').map(line => `  ${line}`).join('\n')}\n</div>`
    app.setContent(nested)
    selection.value = { ...selection.value!, kind: 'component', tag: 'StudioTable', nested: true, range: [1, nested.split('\n').length - 1] }
    tableCell.value = { row: 0, column: 1 }
    const text = '"quoted"\nand another line'
    const paste = clipboard('paste', new Map([['text/plain', text]]))
    app.document.dispatchEvent(paste.event)
    expect(paste.event.defaultPrevented).toBe(true)
    const afterPaste = app.content()
    expect(readTable(afterPaste, [1, afterPaste.split('\n').length - 1]).table.rows).toEqual([['keep', text]])

    const cellCopy = clipboard('copy')
    selection.value = { ...selection.value!, range: [1, afterPaste.split('\n').length - 1] }
    app.document.dispatchEvent(cellCopy.event)
    expect(cellCopy.event.defaultPrevented).toBe(true)
    expect(cellCopy.values.get('text/plain')).toBe('"""quoted""\nand another line"')
    tableCell.value = null
    const objectCopy = clipboard('copy')
    app.document.dispatchEvent(objectCopy.event)
    expect(objectCopy.event.defaultPrevented).toBe(false)

    tableCell.value = { row: 0, column: 1 }
    original.values.set('text/plain', 'incoming\tgrid')
    app.document.dispatchEvent(clipboard('paste', original.values).event)
    expect(app.writes()).toBe(2)
    expect(app.content()).toContain('<img v-drag="[30,40,100,80]" src="/photo.png" />')
    expect(app.content()).not.toContain('incoming')
  })
})
