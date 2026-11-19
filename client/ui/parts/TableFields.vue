<script setup lang="ts">
import type { TableAlign, TableColumn, TableData } from '../../../shared/table'
import type { TableStylePatch } from '../../md/table'
import { addColumn, addRow, moveColumn, removeColumn } from '../../../shared/table'
import { computed } from 'vue'
import { editSource } from '../../actions'
import { useStudio } from '../../context'
import { action, t } from '../../i18n'
import { readTable, writeTable, writeTableStyle } from '../../md/table'
import { clampTableCell, defaultTableCell } from '../../md/table-cell'
import { busy, editing, selection, tableCell, tableEditRequest } from '../../state'
import StudioIcon from './StudioIcon.vue'

const ALIGNMENTS: { value: TableAlign, icon: string, label: 'alignLeft' | 'alignCenter' | 'alignRight' }[] = [
  { value: 'left', icon: 'align-left', label: 'alignLeft' },
  { value: 'center', icon: 'align-center', label: 'alignCenter' },
  { value: 'right', icon: 'align-right', label: 'alignRight' },
]

const studio = useStudio()
const range = computed(() => selection.value?.range)
const state = computed(() => range.value ? readTable(studio.content(), range.value) : null)
const table = computed(() => state.value?.table ?? null)
const unparsed = computed(() => !!state.value?.unparsed)
const locked = computed(() => busy.value || editing.value)
const selected = computed(() => Math.min(tableCell.value?.column ?? 0, Math.max(0, (table.value?.columns.length ?? 1) - 1)))
const current = computed(() => table.value?.columns[selected.value] ?? null)

async function commit(next: TableData) {
  if (locked.value || !range.value)
    return
  await studio.commit(writeTable(studio.content(), range.value, next), action('actionTableEdit'))
}

async function commitStyle(patch: TableStylePatch) {
  if (locked.value || !range.value)
    return
  await studio.commit(writeTableStyle(studio.content(), range.value, patch), action('actionTableEdit'))
}

function updateColumn(index: number, patch: Partial<TableColumn>) {
  if (!table.value)
    return
  void commit({ ...table.value, columns: table.value.columns.map((column, position) => position === index ? { ...column, ...patch } : column) })
}

function setWidth(raw: string) {
  if (!raw.trim()) {
    updateColumn(selected.value, { width: undefined })
    return
  }
  const width = Number(raw)
  if (Number.isFinite(width) && width > 0 && width <= 100)
    updateColumn(selected.value, { width })
}

function setFontSize(raw: string) {
  if (!table.value)
    return
  if (!raw.trim()) {
    void commitStyle({ fontSize: null })
    return
  }
  const size = Number(raw)
  if (Number.isFinite(size) && size > 0)
    void commitStyle({ fontSize: size })
}

async function appendColumn() {
  if (!table.value)
    return
  const index = table.value.columns.length
  await commit(addColumn(table.value, index, { label: t('tableColumn', { index: index + 1 }) }))
  tableCell.value = { row: tableCell.value?.row ?? null, column: index }
}

async function appendRow() {
  if (!table.value)
    return
  const next = addRow(table.value)
  await commit(next)
  tableCell.value = { row: next.rows.length - 1, column: 0 }
}

async function removeSelectedColumn() {
  if (!table.value)
    return
  const next = removeColumn(table.value, selected.value)
  await commit(next)
  tableCell.value = clampTableCell(next, tableCell.value ?? { row: null, column: selected.value })
}

function moveSelected(direction: -1 | 1) {
  if (!table.value)
    return
  const target = selected.value + direction
  if (target < 0 || target >= table.value.columns.length)
    return
  void commit(moveColumn(table.value, selected.value, direction))
  tableCell.value = { row: tableCell.value?.row ?? null, column: target }
}

function editCell() {
  if (!table.value)
    return
  tableEditRequest.value = tableCell.value ?? defaultTableCell(table.value)
}
</script>

<template>
  <div class="studio-table-fields">
    <template v-if="unparsed">
      <p class="studio-hint">{{ t('tableUnparsed') }}</p>
      <button type="button" class="studio-button" @click="editSource">
        <StudioIcon name="code" :size="14" /> {{ t('editSource') }}
      </button>
    </template>

    <template v-else-if="table">
      <p class="studio-hint">{{ t('tableEditHint') }}</p>

      <div class="studio-table-summary">
        <span>{{ t('tableSizeSummary', { columns: table.columns.length, rows: table.rows.length }) }}</span>
        <button type="button" class="studio-button" :disabled="locked" @click="editCell">
          <StudioIcon name="edit" :size="13" /> {{ t('tableEditCell') }}
        </button>
      </div>

      <div class="studio-table-toolbar">
        <button type="button" class="studio-button" :disabled="locked" @click="appendColumn">
          <StudioIcon name="plus" :size="13" /> {{ t('tableAddColumn') }}
        </button>
        <button type="button" class="studio-button" :disabled="locked || !table.columns.length" @click="appendRow">
          <StudioIcon name="plus" :size="13" /> {{ t('tableAddRow') }}
        </button>
      </div>

      <div class="studio-table-style">
        <label><input type="checkbox" :checked="table.header" :disabled="locked" @change="commitStyle({ header: ($event.target as HTMLInputElement).checked })"> {{ t('tableHeader') }}</label>
        <label><input type="checkbox" :checked="table.border" :disabled="locked" @change="commitStyle({ border: ($event.target as HTMLInputElement).checked })"> {{ t('tableBorder') }}</label>
        <label><input type="checkbox" :checked="table.striped" :disabled="locked" @change="commitStyle({ striped: ($event.target as HTMLInputElement).checked })"> {{ t('tableStriped') }}</label>
        <label class="studio-table-style__size">
          <span>{{ t('tableFontSize') }}</span>
          <input class="studio-table-size-input" type="number" min="1" :value="table.fontSize ?? ''" :placeholder="t('auto')" :disabled="locked" @change="setFontSize(($event.target as HTMLInputElement).value)">
          <span>px</span>
        </label>
      </div>

      <div v-if="current" class="studio-table-columnbar">
        <span class="studio-table-columnbar__title">{{ t('tableColumn', { index: selected + 1 }) }}</span>
        <div class="studio-table-align" role="group" :aria-label="t('tableAlign')">
          <button
            v-for="option in ALIGNMENTS"
            :key="option.value"
            type="button"
            class="studio-icon-button"
            :aria-pressed="(current.align ?? 'left') === option.value"
            :title="t(option.label)"
            :aria-label="t(option.label)"
            :disabled="locked"
            @click="updateColumn(selected, { align: option.value })"
          >
            <StudioIcon :name="option.icon" :size="13" />
          </button>
        </div>
        <label class="studio-table-width" :title="t('tableWidthPercent')">
          <input
            class="studio-table-width-input"
            type="number"
            min="1"
            max="100"
            :value="current.width ?? ''"
            :placeholder="t('auto')"
            :aria-label="t('tableWidthPercent')"
            :disabled="locked"
            @change="setWidth(($event.target as HTMLInputElement).value)"
          >
          <span>%</span>
        </label>
        <div class="studio-table-columnbar__actions">
          <button type="button" class="studio-icon-button" :disabled="locked || selected === 0" :title="t('tableMoveColumnLeft')" :aria-label="t('tableMoveColumnLeft')" @click="moveSelected(-1)"><StudioIcon name="back" :size="12" /></button>
          <button type="button" class="studio-icon-button" :disabled="locked || selected === table.columns.length - 1" :title="t('tableMoveColumnRight')" :aria-label="t('tableMoveColumnRight')" @click="moveSelected(1)"><StudioIcon name="back" :size="12" style="transform: scaleX(-1)" /></button>
          <button type="button" class="studio-icon-button" :disabled="locked" :title="t('tableRemoveColumn')" :aria-label="t('tableRemoveColumn')" @click="removeSelectedColumn"><StudioIcon name="trash" :size="12" /></button>
        </div>
      </div>

      <p class="studio-hint">{{ t('tableCellHint') }}</p>
    </template>
  </div>
</template>

<style scoped>
.studio-table-fields { display: grid; gap: 10px; min-width: 0; }
.studio-table-summary { display: flex; align-items: center; justify-content: space-between; gap: 8px; color: var(--studio-text-dim); font-size: 12px; }
.studio-table-summary .studio-button { width: auto; padding: 4px 8px; font-size: 12px; }
.studio-table-toolbar { display: flex; gap: 6px; }
.studio-table-toolbar .studio-button { width: auto; flex: 1; padding: 5px 8px; font-size: 12px; }
.studio-table-style { display: flex; flex-wrap: wrap; gap: 6px 14px; align-items: center; color: var(--studio-text-dim); font-size: 12px; }
.studio-table-style label { display: inline-flex; align-items: center; gap: 5px; }
.studio-table-style input[type="checkbox"] { margin: 0; accent-color: var(--studio-accent); }
.studio-table-style__size { margin-left: auto; white-space: nowrap; }
.studio-table-size-input { flex: 0 0 54px; width: 54px; padding: 3px 6px; font-size: 12px; }
.studio-table-columnbar { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; padding: 5px 6px; background: var(--studio-bg-soft); border: 1px solid var(--studio-border); border-radius: 6px; }
.studio-table-columnbar__title { color: var(--studio-text-dim); font-size: 12px; white-space: nowrap; }
.studio-table-columnbar__actions { display: flex; gap: 1px; margin-left: auto; }
.studio-table-align { display: flex; flex: none; gap: 1px; }
.studio-table-align .studio-icon-button, .studio-table-columnbar__actions .studio-icon-button { width: 20px; height: 20px; border-radius: 4px; }
.studio-table-align .studio-icon-button[aria-pressed="true"] { background: var(--studio-accent-soft); color: var(--studio-accent); }
.studio-table-width { display: flex; align-items: center; gap: 2px; }
.studio-table-width-input { flex: 0 0 54px; width: 54px; padding: 2px 4px; font-size: 11px; }
.studio-table-width span { color: var(--studio-text-dim); font-size: 10px; }
</style>