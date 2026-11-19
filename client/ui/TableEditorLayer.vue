<script setup lang="ts">
import type { TableCellPosition } from '../md/table-cell'
import type { TableData } from '../../shared/table'
import type { SourceRange } from '../types'
import { addRow } from '../../shared/table'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useStudio } from '../context'
import { action, t } from '../i18n'
import { endOfBlock } from '../md/lines'
import { readTable, writeTable } from '../md/table'
import { clampTableCell, defaultTableCell, nextTableCell, tableCellValue, withTableCellValue } from '../md/table-cell'
import { opensWithTag } from '../md/tags'
import { selection, tableCell, tableEditRequest, tableEditing } from '../state'

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
  const found = hit(event)
  if (found)
    tableCell.value = found.position
}

function pointerDown(event: PointerEvent) {
  if (event.button !== 0 || moving)
    return
  if (tableEditing.value && !(event.target instanceof Element && event.target.closest('.studio-table-cell-editor')))
    void close(true)
  const found = hit(event)
  if (!found)
    return
  tableCell.value = found.position
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
  cancelAnimationFrame(frame)
  document.removeEventListener('pointerdown', pointerDown, true)
  document.removeEventListener('click', click, true)
  document.removeEventListener('dblclick', doubleClick, true)
})
</script>

<template>
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