<script setup lang="ts">
import type { TableColumn, TableMerge } from '../shared/table'
import { computed } from 'vue'
import { normaliseTable, resolveTableGrid } from '../shared/table'
import { sanitiseCellHTML } from '../shared/table-html'

const props = withDefaults(defineProps<{
  columns?: TableColumn[]
  rows?: string[][]
  header?: boolean
  border?: boolean
  striped?: boolean
  fontSize?: number
  rich?: boolean
  merges?: TableMerge[]
  headerHeight?: number
  rowHeights?: (number | null)[]
}>(), { columns: () => [], rows: () => [], header: true, border: true, striped: false, rich: false, merges: () => [], rowHeights: () => [] })

/** Rows may arrive before columns when the source only declares `:rows`. */
const table = computed(() => {
  const columns = props.columns.length
    ? props.columns
    : Array.from({ length: props.rows.reduce((most, row) => Math.max(most, row.length), 0) }, () => ({ label: '' }))
  return normaliseTable({
    columns,
    rows: props.rows,
    header: props.header,
    border: props.border,
    striped: props.striped,
    fontSize: props.fontSize,
    rich: props.rich,
    merges: props.merges,
    headerHeight: props.headerHeight,
    rowHeights: props.rowHeights,
  })
})
const grid = computed(() => resolveTableGrid(table.value))
const headerCells = computed(() => table.value.header ? grid.value[0] ?? [] : [])
const bodyRows = computed(() => table.value.header ? grid.value.slice(1) : grid.value)
const richContent = computed(() => table.value.rich ? {
  labels: table.value.columns.map(column => sanitiseCellHTML(column.label)),
  rows: table.value.rows.map(row => row.map(cell => sanitiseCellHTML(cell))),
} : null)

function rowStyle(row: number | null) {
  const height = row === null ? table.value.headerHeight : table.value.rowHeights?.[row] ?? null
  return height ? { height: `${height}px` } : undefined
}

function cellText(row: number, column: number) {
  return row === -1
    ? table.value.columns[column]?.label ?? ''
    : table.value.rows[row]?.[column] ?? ''
}

function cellHTML(row: number, column: number) {
  return row === -1
    ? richContent.value?.labels[column] ?? ''
    : richContent.value?.rows[row]?.[column] ?? ''
}
</script>

<template>
  <div
    class="studio-table"
    data-studio-table
    :class="{ 'studio-table--border': table.border, 'studio-table--striped': table.striped }"
    :style="table.fontSize ? { fontSize: `${table.fontSize}px` } : undefined"
  >
    <table>
      <colgroup>
        <col v-for="(column, index) in table.columns" :key="index" :style="column.width ? { width: `${column.width}%` } : undefined">
      </colgroup>
      <thead v-if="table.header && table.columns.length">
        <tr :style="rowStyle(null)">
          <template v-for="cell in headerCells" :key="cell.column">
            <th
              v-if="!cell.covered"
              :data-studio-table-cell="`-1,${cell.column}`"
              :colspan="cell.colspan > 1 ? cell.colspan : undefined"
              :rowspan="cell.rowspan > 1 ? cell.rowspan : undefined"
              :style="{ textAlign: table.columns[cell.column]?.align }"
            >
              <span v-if="richContent" class="studio-table-cell-content" v-html="cellHTML(-1, cell.column)" />
              <span v-else class="studio-table-cell-content">{{ cellText(-1, cell.column) }}</span>
            </th>
          </template>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(row, rowIndex) in bodyRows" :key="rowIndex" :style="rowStyle(rowIndex)">
          <template v-for="cell in row" :key="cell.column">
            <td
              v-if="!cell.covered"
              :data-studio-table-cell="`${rowIndex},${cell.column}`"
              :colspan="cell.colspan > 1 ? cell.colspan : undefined"
              :rowspan="cell.rowspan > 1 ? cell.rowspan : undefined"
              :style="{ textAlign: table.columns[cell.column]?.align ?? 'left' }"
            >
              <span v-if="richContent" class="studio-table-cell-content" v-html="cellHTML(rowIndex, cell.column)" />
              <span v-else class="studio-table-cell-content">{{ cellText(rowIndex, cell.column) }}</span>
            </td>
          </template>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<style scoped>
.studio-table { width: 100%; color: inherit; }
.studio-table table { width: 100%; border-collapse: collapse; table-layout: fixed; }
.studio-table th, .studio-table td { height: 1.55em; padding: 0.42em 0.7em; overflow-wrap: anywhere; vertical-align: middle; font: inherit; line-height: 1.35; white-space: pre-wrap; }
.studio-table th:empty::after, .studio-table td:empty::after { content: '\00a0'; }
.studio-table .studio-table-cell-content:empty::after { content: '\00a0'; }
.studio-table th { font-weight: 600; background: color-mix(in srgb, currentColor 7%, transparent); }
.studio-table--border th, .studio-table--border td { border: 1px solid color-mix(in srgb, currentColor 22%, transparent); }
.studio-table--striped tbody tr:nth-child(even) { background: color-mix(in srgb, currentColor 5%, transparent); }
</style>

<studio lang="yaml">
propsMode: declared
description: 可合并单元格并设置行列尺寸的表格；可选富文本单元格，列宽、对齐与表头在右侧编辑
category: 内容
snippet: >-
  <StudioTable :columns="[{ label: '列 1' }, { label: '列 2' }, { label: '列 3' }]" :rows="[['', '', ''], ['', '', '']]" />
props:
  columns:
    hidden: true
  rows:
    hidden: true
  header:
    hidden: true
  border:
    hidden: true
  striped:
    hidden: true
  fontSize:
    hidden: true
  rich:
    hidden: true
  merges:
    hidden: true
  headerHeight:
    hidden: true
  rowHeights:
    hidden: true
</studio>
