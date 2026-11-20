<script setup lang="ts">
import type { TableCellPosition } from '../md/table-cell'
import type { TableData } from '../../shared/table'
import type { SourceRange } from '../types'
import type { Editor } from '@tiptap/core'
import type { Node as TextNode } from '@tiptap/pm/model'
import { useRafFn } from '@vueuse/core'
import { addRow, clearColumnWidths, resizeColumnWidths, withRowHeight } from '../../shared/table'
import { editorHTMLToCell } from '../../shared/table-html'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import { useStudio } from '../context'
import { action, t } from '../i18n'
import { endOfBlock, getBlock, toLines } from '../md/lines'
import { readTable, writeTable } from '../md/table'
import { clampTableCell, defaultTableCell, nextTableCell, tableCellValue, tableRectBetween, withTableCellValue } from '../md/table-cell'
import { busy, editing, reportError, ribbonTab, selection, selectedTargets, tableCell, tableEditRequest, tableEditing, tableRange } from '../state'
import { tableCellDefaults, tableCellEditor, tableCellRevision } from '../table-cell-text'
import { createTextEditor } from '../text/editor'
import type { TextDefaults } from '../text/editor'

interface EditorRect {
  left: number
  top: number
  width: number
  height: number
  font: string
  size: number
  weight: string
  color: string
  align: string
  background: string
  padding: string
  lineHeight: string
}

const studio = useStudio()
const active = ref<TableCellPosition | null>(null)
const draft = ref('')
const cell = ref<HTMLElement | null>(null)
const textarea = ref<HTMLTextAreaElement | null>(null)
const rect = ref<EditorRect | null>(null)
const richEditing = ref(false)
const richHost = ref<HTMLElement | null>(null)
const richEditor = shallowRef<Editor | null>(null)
let richOriginalDoc: TextNode | null = null
let richStopKeys: (() => void) | null = null
let frame = 0
let needsFocus = false
let waitingSince = 0
let lastClick: { key: string, time: number, root: HTMLElement } | null = null
let session: { no: number, start: number, root: HTMLElement, block: string } | null = null
let movePromise: Promise<void> | null = null
let closePromise: Promise<void> | null = null
let rangeDrag: { pointerId: number, root: HTMLElement, start: TableCellPosition, table: TableData, moved: boolean } | null = null
let shiftGesture = false

const editorStyle = computed(() => rect.value && {
  left: `${rect.value.left}px`,
  top: `${rect.value.top}px`,
  width: `${rect.value.width}px`,
  height: `${rect.value.height}px`,
  fontFamily: rect.value.font,
  fontSize: `${rect.value.size}px`,
  fontWeight: rect.value.weight,
  color: rect.value.color,
  textAlign: rect.value.align as 'left' | 'center' | 'right',
  background: rect.value.background,
  padding: rect.value.padding,
  lineHeight: rect.value.lineHeight,
})

interface MeasuredRow {
  index: number | null
  top: number
  bottom: number
  height: number
  el: HTMLTableRowElement
}

interface TableMeasure {
  table: HTMLTableElement
  left: number
  top: number
  width: number
  height: number
  scale: number
  columns: { left: number, right: number }[]
  /** Column edges come from a row no merge splits, so handles are exact. */
  exactColumns: boolean
  rows: MeasuredRow[]
}

interface ColumnDrag {
  kind: 'column'
  boundary: number
  startX: number
  tableWidth: number
  widths: number[]
  cols: HTMLTableColElement[]
  originals: string[]
  last: number[]
  moved: boolean
}

interface RowDrag {
  kind: 'row'
  index: number | null
  startY: number
  startHeight: number
  scale: number
  tr: HTMLTableRowElement
  original: string
  height: number
  moved: boolean
}

const measure = shallowRef<TableMeasure | null>(null)
const drag = ref<ColumnDrag | RowDrag | null>(null)
const guide = shallowRef<{ axis: 'x' | 'y', at: number } | null>(null)

function measureColumns(table: HTMLTableElement, count: number) {
  const rows = [...table.rows]
  const exactRow = rows.find(row => row.cells.length === count
    && [...row.cells].every(cell => cell.colSpan === 1 && cell.rowSpan === 1))
  if (exactRow) {
    return {
      columns: [...exactRow.cells].map((cell) => {
        const bounds = cell.getBoundingClientRect()
        return { left: bounds.left, right: bounds.right }
      }),
      exact: true,
    }
  }
  // Every row is merged: split each cell's width across its span so the range
  // highlight still has column edges. Those edges are not used for handles.
  const candidate = rows
    .filter(row => [...row.cells].reduce((sum, cell) => sum + Math.max(1, cell.colSpan), 0) === count)
    .sort((a, b) => b.cells.length - a.cells.length)[0]
  if (!candidate || !count)
    return { columns: [], exact: false }
  const edges: number[] = []
  const first = candidate.cells[0].getBoundingClientRect().left
  for (const cell of candidate.cells) {
    const bounds = cell.getBoundingClientRect()
    const span = Math.max(1, cell.colSpan)
    for (let part = 1; part <= span; part++)
      edges.push(bounds.left + bounds.width * part / span)
  }
  if (edges.length !== count)
    return { columns: [], exact: false }
  return {
    columns: edges.map((right, index) => ({ left: index ? edges[index - 1] : first, right })),
    exact: false,
  }
}

function measureTable(): TableMeasure | null {
  const root = selection.value?.el
  if (!root?.isConnected || selection.value?.tag !== 'StudioTable')
    return null
  const table = root.querySelector('table')
  if (!table)
    return null
  const box = table.getBoundingClientRect()
  if (!box.width || !box.height)
    return null
  const headerRows = table.tHead?.rows.length ?? 0
  const rows: MeasuredRow[] = [...table.rows].map((row, index) => {
    const bounds = row.getBoundingClientRect()
    return {
      index: index < headerRows ? -1 : index - headerRows,
      top: bounds.top,
      bottom: bounds.bottom,
      height: bounds.height,
      el: row,
    }
  })
  const count = root.querySelectorAll('colgroup col').length
  const layout = measureColumns(table, count)
  return {
    table,
    left: box.left,
    top: box.top,
    width: box.width,
    height: box.height,
    scale: table.offsetWidth ? box.width / table.offsetWidth : (studio.canvas.scale.value || 1),
    columns: layout.columns,
    exactColumns: layout.exact,
    rows,
  }
}

function sameMeasure(a: TableMeasure | null, b: TableMeasure | null) {
  if (!a || !b)
    return a === b
  if (a.table !== b.table || a.exactColumns !== b.exactColumns)
    return false
  for (const key of ['left', 'top', 'width', 'height', 'scale'] as const)
    if (Math.abs(a[key] - b[key]) > 0.5) return false
  if (a.columns.length !== b.columns.length || a.rows.length !== b.rows.length)
    return false
  for (let index = 0; index < a.columns.length; index++) {
    if (Math.abs(a.columns[index].left - b.columns[index].left) > 0.5
      || Math.abs(a.columns[index].right - b.columns[index].right) > 0.5)
      return false
  }
  for (let index = 0; index < a.rows.length; index++) {
    const left = a.rows[index], right = b.rows[index]
    if (left.el !== right.el || left.index !== right.index
      || Math.abs(left.top - right.top) > 0.5 || Math.abs(left.bottom - right.bottom) > 0.5)
      return false
  }
  return true
}

let measuredAt = 0
useRafFn(() => {
  if (drag.value)
    return
  if (tableEditing.value) {
    if (measure.value)
      measure.value = null
    return
  }
  const now = performance.now()
  if (now - measuredAt < 120)
    return
  measuredAt = now
  const next = measureTable()
  if (!sameMeasure(measure.value, next))
    measure.value = next
})

const columnHandles = computed(() => measure.value?.exactColumns
  ? measure.value.columns.slice(0, -1).map((column, boundary) => ({ boundary, x: column.right }))
  : [])
const rowHandles = computed(() => measure.value?.rows.slice(0, -1).map(row => ({ row, y: row.bottom })) ?? [])
const rangeBox = computed(() => {
  const current = measure.value
  const range = tableRange.value
  if (!current || selectedTargets.value.length !== 1)
    return null
  if (!range) {
    const position = tableCell.value
    const cell = position && current.table.querySelector(`[data-studio-table-cell="${position.row ?? -1},${position.column}"]`)
    const bounds = cell?.getBoundingClientRect()
    return bounds ? {
      left: `${bounds.left}px`,
      top: `${bounds.top}px`,
      width: `${bounds.width}px`,
      height: `${bounds.height}px`,
    } : null
  }
  const left = current.columns[range.columnStart]?.left
  const right = current.columns[range.columnEnd]?.right
  const top = current.rows.find(row => row.index === range.rowStart)?.top
  const bottom = current.rows.find(row => row.index === range.rowEnd)?.bottom
  if (left === undefined || right === undefined || top === undefined || bottom === undefined)
    return null
  return {
    left: `${left}px`,
    top: `${top}px`,
    width: `${right - left}px`,
    height: `${bottom - top}px`,
  }
})

function roundWidth(value: number) {
  return Math.round(value * 10) / 10
}

function listenDrag() {
  window.addEventListener('pointermove', dragMove, true)
  window.addEventListener('pointerup', dragEnd, true)
  window.addEventListener('pointercancel', dragCancel, true)
  window.addEventListener('keydown', dragKey, true)
  window.addEventListener('blur', dragCancel, true)
}

function unlistenDrag() {
  window.removeEventListener('pointermove', dragMove, true)
  window.removeEventListener('pointerup', dragEnd, true)
  window.removeEventListener('pointercancel', dragCancel, true)
  window.removeEventListener('keydown', dragKey, true)
  window.removeEventListener('blur', dragCancel, true)
}

function startColumnResize(event: PointerEvent, boundary: number) {
  if (event.button !== 0 || busy.value || drag.value || !sourceTable())
    return
  const current = measure.value
  if (!current?.exactColumns || boundary < 0 || boundary >= current.columns.length - 1)
    return
  event.preventDefault()
  event.stopPropagation()
  const widths = current.columns.map(column => (column.right - column.left) / current.width * 100)
  const cols = [...current.table.querySelectorAll<HTMLTableColElement>('colgroup col')]
  drag.value = {
    kind: 'column',
    boundary,
    startX: event.clientX,
    tableWidth: current.width,
    widths,
    cols,
    originals: cols.map(col => col.style.width),
    last: widths,
    moved: false,
  }
  listenDrag()
}

function startRowResize(event: PointerEvent, row: MeasuredRow) {
  if (event.button !== 0 || busy.value || drag.value || !sourceTable())
    return
  const current = measure.value
  if (!current)
    return
  event.preventDefault()
  event.stopPropagation()
  drag.value = {
    kind: 'row',
    index: row.index,
    startY: event.clientY,
    startHeight: row.height / current.scale,
    scale: current.scale,
    tr: row.el,
    original: row.el.style.height,
    height: row.height / current.scale,
    moved: false,
  }
  listenDrag()
}

function dragMove(event: PointerEvent) {
  const current = drag.value
  if (!current)
    return
  event.preventDefault()
  if (current.kind === 'column') {
    const delta = (event.clientX - current.startX) / current.tableWidth * 100
    const next = resizeColumnWidths(current.widths, current.boundary, delta, 5)
    current.last = next
    next.forEach((width, index) => {
      const col = current.cols[index]
      if (col)
        col.style.width = `${Math.round(width * 100) / 100}%`
    })
    current.moved = next.some((width, index) => Math.abs(width - current.widths[index]) > 0.01)
    guide.value = { axis: 'x', at: event.clientX }
  }
  else {
    const next = Math.max(8, current.startHeight + (event.clientY - current.startY) / current.scale)
    current.height = next
    current.tr.style.height = `${Math.round(next)}px`
    current.moved = Math.abs(next - current.startHeight) > 0.5
    guide.value = { axis: 'y', at: event.clientY }
  }
}

function restoreDrag(current: ColumnDrag | RowDrag) {
  if (current.kind === 'column')
    current.cols.forEach((col, index) => { col.style.width = current.originals[index] ?? '' })
  else
    current.tr.style.height = current.original
}

async function dragEnd() {
  const current = drag.value
  unlistenDrag()
  drag.value = null
  guide.value = null
  if (!current)
    return
  if (!current.moved) {
    restoreDrag(current)
    return
  }
  const range = currentRange()
  const table = sourceTable()
  if (!range || !table || busy.value) {
    restoreDrag(current)
    return
  }
  let next = table
  if (current.kind === 'column') {
    const rounded = current.last.map(roundWidth)
    const sum = rounded.slice(0, -1).reduce((total, width) => total + width, 0)
    rounded[rounded.length - 1] = roundWidth(Math.max(0.1, 100 - sum))
    next = {
      ...table,
      columns: table.columns.map((column, index) => ({ ...column, width: rounded[index] })),
    }
  }
  else {
    next = withRowHeight(table, current.index, Math.round(current.height))
  }
  try {
    await studio.commit(writeTable(studio.content(), range, next), action('actionTableEdit'))
  }
  catch (error) {
    restoreDrag(current)
    reportError(error)
  }
}

function dragCancel() {
  const current = drag.value
  unlistenDrag()
  drag.value = null
  guide.value = null
  if (current)
    restoreDrag(current)
}

function dragKey(event: KeyboardEvent) {
  if (event.key !== 'Escape')
    return
  event.preventDefault()
  event.stopPropagation()
  void dragCancel()
}

async function resetRowHeight(row: MeasuredRow) {
  const range = currentRange()
  const table = sourceTable()
  if (!range || !table)
    return
  await studio.commit(writeTable(studio.content(), range, withRowHeight(table, row.index, null)), action('actionTableEdit'))
}

async function resetColumnWidths(boundary: number) {
  const range = currentRange()
  const table = sourceTable()
  if (!range || !table)
    return
  const columns = clearColumnWidths(table.columns, boundary)
  if (columns === table.columns)
    return
  await studio.commit(writeTable(studio.content(), range, { ...table, columns }), action('actionTableEdit'))
}


/** Keep the draft tied to the original source across saves and render updates. */
function sessionRange(): SourceRange | null {
  if (!session || session.no !== studio.no())
    return null
  const lines = toLines(studio.content())
  const end = endOfBlock(lines, session.start)
  const block = lines.slice(session.start, end).join('\n')
  return block === session.block ? [session.start, end] : null
}

function currentRange(): SourceRange | null {
  if (session)
    return sessionRange()
  const target = selection.value
  return target?.tag === 'StudioTable' && target.no === studio.no() ? target.range : null
}

function sourceTable(): TableData | null {
  const range = currentRange()
  if (!range)
    return null
  const read = readTable(studio.content(), range)
  return read.unparsed ? null : read.table
}

async function commitCellTable(range: SourceRange, table: TableData) {
  const current = session
  const next = writeTable(studio.content(), range, table)
  await studio.commit(next, action('actionTableEdit'))
  if (current) {
    const lines = toLines(next)
    current.block = lines.slice(current.start, endOfBlock(lines, current.start)).join('\n')
  }
}

function cellDefaults(): TextDefaults {
  const target = cell.value?.isConnected ? cell.value : active.value ? findCell(active.value) : null
  if (!target)
    return {}
  const style = getComputedStyle(target)
  const fontSize = Number.parseFloat(style.fontSize) || 16
  return {
    fontFamily: style.fontFamily || 'sans-serif',
    fontSize,
    color: style.color || '#000000',
    align: style.textAlign === 'start' ? 'left' : style.textAlign || 'left',
    lineHeight: style.lineHeight === 'normal' ? '1.35' : String(Math.round((Number.parseFloat(style.lineHeight) / fontSize || 1.35) * 100) / 100),
  }
}

function richValue(): string | null {
  return richEditor.value ? editorHTMLToCell(richEditor.value.getHTML()) : null
}

function richChanged() {
  return !!richEditor.value && !!richOriginalDoc && !richEditor.value.state.doc.eq(richOriginalDoc)
}

function destroyRichEditor() {
  richStopKeys?.()
  richStopKeys = null
  richEditor.value?.destroy()
  richEditor.value = null
  richOriginalDoc = null
  tableCellEditor.value = null
  tableCellDefaults.value = {}
}

function richKeydown(instance: Editor, event: KeyboardEvent) {
  if (event.isComposing || instance.view.composing)
    return false
  if (event.key === 'Tab') {
    event.preventDefault()
    void move(event.shiftKey ? -1 : 1).catch(reportError)
    return true
  }
  if (event.key === 'Escape') {
    event.preventDefault()
    void close(false).catch(reportError)
    return true
  }
  if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
    event.preventDefault()
    void close(true).catch(reportError)
    return true
  }
  if (event.key === 'Enter') {
    event.preventDefault()
    instance.commands.setHardBreak()
    return true
  }
  return false
}

function richPaste(instance: Editor, event: ClipboardEvent) {
  const text = event.clipboardData?.getData('text/plain')
  if (text === undefined)
    return false
  event.preventDefault()
  if (!text)
    return true
  const nodes: any[] = []
  text.replace(/\r\n?/g, '\n').split('\n').forEach((line, index) => {
    if (index)
      nodes.push({ type: 'hardBreak' })
    if (line)
      nodes.push({ type: 'text', text: line })
  })
  instance.chain().focus().insertContent(nodes).run()
  return true
}

function createRichEditor(value: string) {
  const host = richHost.value
  if (!host)
    return
  host.replaceChildren()
  const holder: { editor: Editor | null } = { editor: null }
  const instance = createTextEditor(`<p>${value}</p>`, {
    element: host,
    editorProps: {
      attributes: { class: 'studio-rich-editor studio-table-rich-editor', style: 'outline:none;white-space:pre-wrap;min-height:1em;font:inherit;color:inherit;' },
      handleKeyDown: (_view, event) => holder.editor ? richKeydown(holder.editor, event) : false,
      handlePaste: (_view, event) => holder.editor ? richPaste(holder.editor, event) : false,
    },
    onTransaction: () => tableCellRevision.value++,
  }, 'inline')
  holder.editor = instance
  richEditor.value = instance
  richOriginalDoc = instance.state.doc
  tableCellEditor.value = instance
  tableCellDefaults.value = cellDefaults()
  // Keep Slidev's navigation shortcuts away from the cell editor.
  const stop = (event: Event) => event.stopPropagation()
  instance.view.dom.addEventListener('keydown', stop)
  richStopKeys = () => instance.view.dom.removeEventListener('keydown', stop)
}

function findCell(position: TableCellPosition): HTMLElement | null {
  const target = selection.value
  const rebound = target && session && target.no === session.no && target.range?.[0] === session.start ? target.el : null
  const roots = [session?.root, rebound].filter((root): root is HTMLElement => !!root && root.isConnected)
  for (const root of roots) {
    const found = root.querySelector<HTMLElement>(`[data-studio-table-cell="${position.row ?? -1},${position.column}"]`)
    if (found?.isConnected)
      return found
  }
  return null
}

function scaledPadding(style: CSSStyleDeclaration, scale: number) {
  const values = [style.paddingTop, style.paddingRight, style.paddingBottom, style.paddingLeft]
    .map(value => Number.parseFloat(value) * scale)
  return values.every(Number.isFinite) ? values.map(value => `${value}px`).join(' ') : undefined
}

function opaqueBackground(element: HTMLElement) {
  let node: HTMLElement | null = element
  while (node) {
    const color = getComputedStyle(node).backgroundColor
    const rgba = color.match(/^rgba?\(([^)]+)\)/i)
    const alpha = rgba ? Number.parseFloat(rgba[1].split(',')[3] ?? '1') : 1
    if (color && color !== 'transparent' && alpha >= 1)
      return color
    node = node.parentElement
  }
  return '#ffffff'
}

function updateRect() {
  if (!tableEditing.value || !active.value)
    return
  const target = cell.value?.isConnected ? cell.value : findCell(active.value)
  const box = target?.getBoundingClientRect()
  if (!target || !box?.width || !box.height) {
    if (!waitingSince)
      waitingSince = performance.now()
    if (performance.now() - waitingSince > 1500)
      void close(false).catch(reportError)
    return
  }
  waitingSince = 0
  cell.value = target
  const style = getComputedStyle(target)
  const scale = target.offsetWidth ? box.width / target.offsetWidth : (studio.canvas.scale.value || 1)
  rect.value = {
    left: box.left,
    top: box.top,
    width: box.width,
    height: box.height,
    font: style.fontFamily,
    size: (Number.parseFloat(style.fontSize) || 16) * scale,
    weight: style.fontWeight,
    color: style.color,
    align: style.textAlign,
    background: opaqueBackground(target),
    padding: scaledPadding(style, scale) ?? `${4 * scale}px ${7 * scale}px`,
    lineHeight: style.lineHeight === 'normal' ? 'normal' : `${Number.parseFloat(style.lineHeight) * scale}px`,
  }
  if (needsFocus) {
    needsFocus = false
    const position = active.value
    void nextTick(() => {
      if (!tableEditing.value || active.value !== position)
        return
      if (richEditing.value)
        createRichEditor(draft.value)
      focusEditor()
    }).catch(reportError)
  }
}

function tick() {
  updateRect()
  if (tableEditing.value)
    frame = requestAnimationFrame(tick)
}

function focusEditor() {
  if (richEditing.value) {
    richEditor.value?.commands.focus('end', { scrollIntoView: false })
    return
  }
  const input = textarea.value
  if (!input)
    return
  input.focus()
  input.setSelectionRange(input.value.length, input.value.length)
}

function openFrame() {
  cancelAnimationFrame(frame)
  frame = requestAnimationFrame(tick)
}

async function start(position: TableCellPosition, element?: HTMLElement) {
  if (closePromise)
    await closePromise
  if (tableEditing.value || editing.value || busy.value || selectedTargets.value.length !== 1)
    return
  const selected = selection.value
  if (selected?.tag !== 'StudioTable' || !selected.range || selected.no !== studio.no())
    return
  const { range, el: root, no } = selected
  if (element && !root.contains(element))
    return
  const read = readTable(studio.content(), range)
  if (read.unparsed)
    return
  const table = read.table
  const target = clampTableCell(table, position) ?? defaultTableCell(table)
  if (!target)
    return
  session = { no, start: range[0], root, block: getBlock(studio.content(), range) }
  active.value = target
  tableCell.value = target
  tableRange.value = null
  richEditing.value = !!table.rich
  draft.value = tableCellValue(table, target)
  cell.value = element ?? findCell(target)
  needsFocus = true
  waitingSince = 0
  tableEditing.value = true
  if (richEditing.value)
    ribbonTab.value = 'home'
  openFrame()
}

function tableWithDraft(table: TableData) {
  if (!active.value || (richEditing.value && !richChanged()))
    return table
  const value = richEditing.value ? richValue() : draft.value
  return value === null || tableCellValue(table, active.value) === value
    ? table
    : withTableCellValue(table, active.value, value)
}

async function move(direction: -1 | 1) {
  if (!active.value || movePromise || closePromise || busy.value)
    return
  const range = currentRange()
  const table = sourceTable()
  if (!table || !range) {
    finish()
    return
  }
  const current = active.value
  const task = (async () => {
    tableRange.value = null
    const next = nextTableCell(table, current, direction)
    let nextTable = tableWithDraft(table)
    let target: TableCellPosition | null = null
    if (next === 'append-row') {
      nextTable = addRow(nextTable)
      target = { row: nextTable.rows.length - 1, column: 0 }
    }
    else if (next) {
      target = next
    }
    if (nextTable !== table)
      await commitCellTable(range, nextTable)
    if (!target || !sessionRange()) {
      finish()
      return
    }
    active.value = target
    tableCell.value = target
    destroyRichEditor()
    richEditing.value = !!nextTable.rich
    draft.value = tableCellValue(nextTable, target)
    cell.value = null
    rect.value = null
    needsFocus = true
    waitingSince = 0
    await nextTick()
  })()
  movePromise = task
  try {
    await task
  }
  finally {
    movePromise = null
  }
}

function finish() {
  tableEditing.value = false
  active.value = null
  destroyRichEditor()
  richEditing.value = false
  cell.value = null
  rect.value = null
  needsFocus = false
  session = null
  cancelAnimationFrame(frame)
  frame = 0
}

function close(save: boolean): Promise<void> {
  if (closePromise)
    return closePromise
  const task = (async () => {
    if (movePromise)
      await movePromise
    if (save && active.value) {
      const range = currentRange()
      const table = sourceTable()
      if (range && table) {
        const next = tableWithDraft(table)
        if (next !== table)
          await commitCellTable(range, next)
      }
    }
    finish()
  })()
  closePromise = task
  const clear = () => {
    if (closePromise === task)
      closePromise = null
  }
  void task.then(clear, clear)
  return task
}

async function apply() {
  if (tableEditing.value)
    await close(true)
}

function keydown(event: KeyboardEvent) {
  if (event.isComposing)
    return
  if (event.key === 'Tab') {
    event.preventDefault()
    void move(event.shiftKey ? -1 : 1).catch(reportError)
    return
  }
  if (event.key === 'Escape') {
    event.preventDefault()
    void close(false).catch(reportError)
  }
  if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
    event.preventDefault()
    void close(true).catch(reportError)
  }
}

function cellInfo(cellEl: HTMLElement) {
  if (cellEl.closest('.studio-filmstrip'))
    return null
  const root = cellEl.closest<HTMLElement>('[data-studio-table]')
  if (!root || root !== selection.value?.el || selectedTargets.value.length !== 1)
    return null
  const [rawRow, rawColumn] = (cellEl.dataset.studioTableCell ?? '').split(',').map(Number)
  if (!Number.isFinite(rawRow) || !Number.isFinite(rawColumn))
    return null
  return { root, cell: cellEl, position: { row: rawRow < 0 ? null : rawRow, column: rawColumn } as TableCellPosition }
}

function hit(event: Event) {
  const target = event.target instanceof Element ? event.target : null
  const direct = target?.closest<HTMLElement>('[data-studio-table-cell]')
  if (direct)
    return cellInfo(direct)

  // A selected object carries a transparent move surface above the canvas, so
  // the event target is that surface rather than the cell under the pointer.
  return target?.closest('.studio-move') && event instanceof MouseEvent ? cellAtPoint(event) : null
}

function cellAtPoint(event: MouseEvent) {
  for (const element of document.elementsFromPoint(event.clientX, event.clientY)) {
    const cellEl = element.closest<HTMLElement>('[data-studio-table-cell]')
    if (cellEl) {
      const found = cellInfo(cellEl)
      if (found)
        return found
    }
  }
  return null
}

function moveRange(event: PointerEvent) {
  const gesture = rangeDrag
  if (!gesture || event.pointerId !== gesture.pointerId)
    return
  const found = hit(event) ?? cellAtPoint(event)
  if (!found || found.root !== gesture.root)
    return
  const { start } = gesture
  if (!gesture.moved && start.row === found.position.row && start.column === found.position.column)
    return
  gesture.moved = true
  tableCell.value = start
  tableRange.value = tableRectBetween(gesture.table, start, found.position)
}

function endRange(event?: PointerEvent) {
  if (event && event.pointerId !== rangeDrag?.pointerId)
    return
  rangeDrag = null
  window.removeEventListener('pointermove', moveRange, true)
  window.removeEventListener('pointerup', endRange, true)
  window.removeEventListener('pointercancel', endRange, true)
  window.removeEventListener('blur', cancelRange, true)
}

function cancelRange() {
  endRange()
}

function click(event: MouseEvent) {
  if (editing.value || shiftGesture || event.shiftKey || (event.target instanceof Element && event.target.closest('.studio-table-resize')))
    return
  const found = hit(event)
  if (found)
    tableCell.value = found.position
}

function pointerDown(event: PointerEvent) {
  if (event.button !== 0 || editing.value || movePromise || drag.value || rangeDrag)
    return
  shiftGesture = false
  const target = event.target instanceof Element ? event.target : null
  if (target?.closest('.studio-table-resize'))
    return
  // The Home-tab format controls must not close the rich cell they act on.
  if (tableEditing.value && richEditing.value && target?.closest('[data-studio-text-controls]'))
    return
  if (tableEditing.value && !target?.closest('.studio-table-cell-editor'))
    void close(true).catch(reportError)
  const found = hit(event)
  if (!found)
    return
  if (event.shiftKey && !busy.value && !tableEditing.value) {
    const table = sourceTable()
    if (!table)
      return
    // This gesture belongs to the cells, so the table's move surface must not start a drag.
    event.preventDefault()
    event.stopImmediatePropagation()
    shiftGesture = true
    lastClick = null
    const anchor = tableCell.value ?? found.position
    tableCell.value = anchor
    tableRange.value = tableRectBetween(table, anchor, found.position)
    rangeDrag = { pointerId: event.pointerId, root: found.root, start: found.position, table, moved: false }
    window.addEventListener('pointermove', moveRange, true)
    window.addEventListener('pointerup', endRange, true)
    window.addEventListener('pointercancel', endRange, true)
    window.addEventListener('blur', cancelRange, true)
    return
  }
  tableCell.value = found.position
  tableRange.value = null
  const key = `${found.position.row ?? -1},${found.position.column}`
  const now = performance.now()
  if (lastClick && lastClick.root === found.root && lastClick.key === key && now - lastClick.time < 500) {
    lastClick = null
    if (selection.value?.el === found.root) {
      event.preventDefault()
      event.stopPropagation()
      void start(found.position, found.cell).catch(reportError)
    }
    return
  }
  lastClick = { key, time: now, root: found.root }
}

function doubleClick(event: MouseEvent) {
  if (shiftGesture || event.shiftKey)
    return
  if (event.target instanceof Element && event.target.closest('.studio-table-resize'))
    return
  const found = hit(event)
  if (!found || selection.value?.el !== found.root)
    return
  event.preventDefault()
  event.stopPropagation()
  void start(found.position, found.cell).catch(reportError)
}

function blur() {
  if (movePromise || closePromise || !tableEditing.value || richEditing.value)
    return
  void close(true).catch(reportError)
}

watch(tableEditRequest, (position) => {
  if (!position)
    return
  tableEditRequest.value = null
  const table = sourceTable()
  const target = table ? clampTableCell(table, position) ?? defaultTableCell(table) : null
  if (target)
    void start(target).catch(reportError)
})

watch(selection, (target, previous) => {
  if (rangeDrag && target?.el !== rangeDrag.root)
    endRange()
  if (drag.value && target?.el !== previous?.el)
    dragCancel()
  if (session && (target?.tag !== 'StudioTable' || target.no !== session.no || target.range?.[0] !== session.start))
    void close(true).catch(reportError)
})

defineExpose({ apply })

onMounted(() => {
  if (!active.value)
    tableEditing.value = false
  document.addEventListener('pointerdown', pointerDown, true)
  document.addEventListener('click', click, true)
  document.addEventListener('dblclick', doubleClick, true)
})
onBeforeUnmount(() => {
  void close(true).catch(reportError)
  destroyRichEditor()
  dragCancel()
  endRange()
  cancelAnimationFrame(frame)
  document.removeEventListener('pointerdown', pointerDown, true)
  document.removeEventListener('click', click, true)
  document.removeEventListener('dblclick', doubleClick, true)
})
</script>

<template>
  <template v-if="measure && !tableEditing">
    <div v-if="rangeBox" class="studio-table-range" :style="rangeBox" />
    <div
      v-for="handle in columnHandles"
      :key="`column-${handle.boundary}`"
      class="studio-table-resize studio-table-resize--column"
      :style="{ left: `${handle.x - 4}px`, top: `${measure.top}px`, height: `${measure.height}px` }"
      :title="t('tableDragColumnWidth')"
      @pointerdown="startColumnResize($event, handle.boundary)"
      @dblclick.stop="resetColumnWidths(handle.boundary)"
    />
    <div
      v-for="handle in rowHandles"
      :key="`row-${handle.row.index ?? 'header'}`"
      class="studio-table-resize studio-table-resize--row"
      :style="{ top: `${handle.y - 4}px`, left: `${measure.left}px`, width: `${measure.width}px` }"
      :title="t('tableDragRowHeight')"
      @pointerdown="startRowResize($event, handle.row)"
      @dblclick.stop="resetRowHeight(handle.row)"
    />
    <div v-if="guide?.axis === 'x'" class="studio-table-guide" :style="{ left: `${guide.at}px`, top: `${measure.top}px`, height: `${measure.height}px` }" />
    <div v-else-if="guide?.axis === 'y'" class="studio-table-guide studio-table-guide--row" :style="{ top: `${guide.at}px`, left: `${measure.left}px`, width: `${measure.width}px` }" />
  </template>
  <textarea
    v-if="tableEditing && rect && !richEditing"
    ref="textarea"
    v-model="draft"
    class="studio-table-cell-editor"
    :style="editorStyle"
    :aria-label="t('tableCellEditor')"
    spellcheck="false"
    @keydown.stop="keydown"
    @blur="blur"
  />
  <div
    v-else-if="tableEditing && rect && richEditing"
    ref="richHost"
    class="studio-table-cell-editor studio-table-cell-editor--rich"
    :style="editorStyle"
    :aria-label="t('tableCellEditor')"
  />
</template>

<style scoped>
.studio-table-range {
  position: fixed;
  z-index: 91;
  pointer-events: none;
  background: color-mix(in srgb, var(--studio-accent) 16%, transparent);
  border: 1px solid var(--studio-accent);
  border-radius: 1px;
}
.studio-table-resize {
  position: fixed;
  z-index: 92;
  padding: 0;
  margin: 0;
  border: 0;
  background: transparent;
}
.studio-table-resize:hover,
.studio-table-resize:active {
  background: color-mix(in srgb, var(--studio-accent) 30%, transparent);
}
.studio-table-resize--column { width: 8px; cursor: col-resize; }
.studio-table-resize--row { height: 8px; cursor: row-resize; }
.studio-table-guide {
  position: fixed;
  z-index: 93;
  width: 1px;
  background: var(--studio-accent);
  pointer-events: none;
}
.studio-table-guide--row {
  width: auto;
  height: 1px;
}
.studio-table-cell-editor {
  position: fixed;
  z-index: 120;
  box-sizing: border-box;
  margin: 0;
  border: 2px solid var(--studio-accent);
  border-radius: 2px;
  outline: none;
  resize: none;
  overflow: auto;
  box-shadow: 0 0 0 3px var(--studio-accent-soft), var(--studio-shadow);
  white-space: pre-wrap;
}
.studio-table-cell-editor--rich { cursor: text; }
.studio-table-rich-editor { margin: 0; }
</style>
