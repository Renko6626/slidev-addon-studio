<script setup lang="ts">
import type { TableCellPosition } from '../md/table-cell'
import type { TableData } from '../../shared/table'
import type { SourceRange } from '../types'
import { useRafFn } from '@vueuse/core'
import { addRow, clearColumnWidths, resizeColumnWidths, withRowHeight } from '../../shared/table'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import { useStudio } from '../context'
import { action, t } from '../i18n'
import { endOfBlock } from '../md/lines'
import { readTable, writeTable } from '../md/table'
import { clampTableCell, defaultTableCell, nextTableCell, tableCellValue, tableRectBetween, withTableCellValue } from '../md/table-cell'
import { opensWithTag } from '../md/tags'
import { busy, reportError, selection, tableCell, tableEditRequest, tableEditing, tableRange } from '../state'

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
let frame = 0
let moving = false
let closing = false
let needsFocus = false
let waitingSince = 0
let suppressBlur = false
let lastClick: { key: string, time: number, root: HTMLElement } | null = null
let session: { start: number, root: HTMLElement } | null = null
let closePromise: Promise<void> | null = null

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
  if (drag.value || tableEditing.value) {
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
  if (!current || !range)
    return null
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
  if (busy.value)
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
  if (busy.value)
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
  if (!range || !table) {
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


/** The table block keeps its start line while cells and rows are edited. */
function sessionRange(): SourceRange | null {
  if (!session)
    return null
  const lines = studio.content().split('\n')
  const end = endOfBlock(lines, session.start)
  const block = lines.slice(session.start, end).join('\n')
  return opensWithTag(block)?.name === 'StudioTable' ? [session.start, end] : null
}

function currentRange(): SourceRange | null {
  return session ? sessionRange() : selection.value?.range ?? null
}

function sourceTable(): TableData | null {
  const range = currentRange()
  if (!range)
    return null
  const read = readTable(studio.content(), range)
  return read.unparsed ? null : read.table
}

function findCell(position: TableCellPosition): HTMLElement | null {
  const roots = [session?.root, selection.value?.el].filter((root): root is HTMLElement => !!root && root.isConnected)
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
  if (!target || !target.isConnected) {
    rect.value = null
    if (!waitingSince)
      waitingSince = performance.now()
    if (performance.now() - waitingSince > 1500)
      void close(false)
    return
  }
  const box = target.getBoundingClientRect()
  if (!box.width || !box.height) {
    rect.value = null
    if (!waitingSince)
      waitingSince = performance.now()
    if (performance.now() - waitingSince > 1500)
      void close(false)
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
    void nextTick(() => focusEditor())
  }
}

function tick() {
  updateRect()
  if (tableEditing.value)
    frame = requestAnimationFrame(tick)
}

function focusEditor() {
  const input = textarea.value
  if (!input)
    return
  suppressBlur = false
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
  if (tableEditing.value)
    return
  const range = selection.value?.range
  const root = selection.value?.el
  if (!range || !root)
    return
  const read = readTable(studio.content(), range)
  if (read.unparsed)
    return
  const table = read.table
  const target = clampTableCell(table, position) ?? defaultTableCell(table)
  if (!target)
    return
  session = { start: range[0], root }
  active.value = target
  tableCell.value = target
  tableRange.value = null
  draft.value = tableCellValue(table, target)
  cell.value = element ?? findCell(target)
  needsFocus = true
  waitingSince = 0
  tableEditing.value = true
  await nextTick()
  openFrame()
}

async function commitDraft(table: TableData): Promise<TableData | null> {
  const range = currentRange()
  if (!active.value || !range)
    return null
  if (tableCellValue(table, active.value) === draft.value)
    return table
  const next = withTableCellValue(table, active.value, draft.value)
  await studio.commit(writeTable(studio.content(), range, next), action('actionTableEdit'))
  return next
}

async function move(direction: -1 | 1) {
  if (!active.value || moving || closing || closePromise)
    return
  tableRange.value = null
  const range = currentRange()
  const table = sourceTable()
  if (!table || !range)
    return
  moving = true
  try {
    const next = nextTableCell(table, active.value, direction)
    let nextTable = withTableCellValue(table, active.value, draft.value)
    let target: TableCellPosition | null = null
    if (next === 'append-row') {
      nextTable = addRow(nextTable)
      target = { row: nextTable.rows.length - 1, column: 0 }
    }
    else if (next) {
      target = next
    }
    if (tableCellValue(table, active.value) !== draft.value || next === 'append-row')
      await studio.commit(writeTable(studio.content(), range, nextTable), action('actionTableEdit'))
    if (!target) {
      await close(false)
      return
    }
    active.value = target
    tableCell.value = target
    draft.value = tableCellValue(nextTable, target)
    cell.value = null
    rect.value = null
    needsFocus = true
    waitingSince = 0
    suppressBlur = true
    await nextTick()
    if (!frame)
      openFrame()
    else
      requestAnimationFrame(tick)
  }
  finally {
    moving = false
  }
}

function close(save: boolean): Promise<void> {
  if (closePromise)
    return closePromise
  const task = (async () => {
    closing = true
    try {
      if (save) {
        const table = sourceTable()
        if (table)
          await commitDraft(table)
      }
      tableEditing.value = false
      active.value = null
      cell.value = null
      rect.value = null
      needsFocus = false
      suppressBlur = false
      session = null
      cancelAnimationFrame(frame)
      frame = 0
    }
    finally {
      closing = false
    }
  })()
  closePromise = task
  void task.finally(() => {
    if (closePromise === task)
      closePromise = null
  })
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
    void move(event.shiftKey ? -1 : 1)
    return
  }
  if (event.key === 'Escape') {
    event.preventDefault()
    void close(false)
  }
}

function cellInfo(cellEl: HTMLElement) {
  if (cellEl.closest('.studio-filmstrip'))
    return null
  const root = cellEl.closest<HTMLElement>('[data-studio-table]')
  if (!root)
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
  if (event instanceof MouseEvent) {
    for (const element of document.elementsFromPoint(event.clientX, event.clientY)) {
      const cellEl = element.closest<HTMLElement>('[data-studio-table-cell]')
      if (cellEl) {
        const found = cellInfo(cellEl)
        if (found)
          return found
      }
    }
  }
  return null
}

function click(event: MouseEvent) {
  if (event.shiftKey || (event.target instanceof Element && event.target.closest('.studio-table-resize')))
    return
  const found = hit(event)
  if (found)
    tableCell.value = found.position
}

function pointerDown(event: PointerEvent) {
  if (event.button !== 0 || moving || drag.value)
    return
  const target = event.target instanceof Element ? event.target : null
  if (target?.closest('.studio-table-resize'))
    return
  if (tableEditing.value && !target?.closest('.studio-table-cell-editor'))
    void close(true)
  const found = hit(event)
  if (!found)
    return
  if (event.shiftKey && tableCell.value) {
    // This gesture belongs to the cell range, never to the table's move surface.
    event.preventDefault()
    event.stopPropagation()
    const table = sourceTable()
    tableRange.value = table ? tableRectBetween(table, tableCell.value, found.position) : null
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
      void start(found.position, found.cell)
    }
    return
  }
  lastClick = { key, time: now, root: found.root }
}

function doubleClick(event: MouseEvent) {
  if (event.target instanceof Element && event.target.closest('.studio-table-resize'))
    return
  const found = hit(event)
  if (!found || selection.value?.el !== found.root)
    return
  event.preventDefault()
  event.stopPropagation()
  void start(found.position, found.cell)
}

function blur() {
  if (moving || closing || suppressBlur || !tableEditing.value)
    return
  void close(true)
}

watch(tableEditRequest, (position) => {
  if (!position)
    return
  tableEditRequest.value = null
  const table = sourceTable()
  const target = table ? clampTableCell(table, position) ?? defaultTableCell(table) : null
  if (target)
    void start(target)
})

watch(selection, (target) => {
  if (tableEditing.value && (!target || target.tag !== 'StudioTable'))
    void close(true)
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
  void close(true)
  unlistenDrag()
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
    v-if="tableEditing && rect"
    ref="textarea"
    v-model="draft"
    class="studio-table-cell-editor"
    :style="editorStyle"
    :aria-label="t('tableCellEditor')"
    spellcheck="false"
    @keydown="keydown"
    @blur="blur"
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
</style>