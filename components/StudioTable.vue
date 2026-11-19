<script setup lang="ts">
import type { TableColumn, TableMerge } from '../shared/table'
import { computed } from 'vue'
import { normaliseTable, resolveTableGrid } from '../shared/table'

const props = withDefaults(defineProps<{
  columns?: TableColumn[]
  rows?: string[][]
  header?: boolean
  border?: boolean
  striped?: boolean
  fontSize?: number
  merges?: TableMerge[]
  headerHeight?: number
  rowHeights?: (number | null)[]
}>(), { columns: () => [], rows: () => [], header: true, border: true, striped: false, merges: () => [], rowHeights: () => [] })

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
    merges: props.merges,
    headerHeight: props.headerHeight,
    rowHeights: props.rowHeights,
  })
})
const grid = computed(() => resolveTableGrid(table.value))
const headerCells = computed(() => table.value.header ? grid.value[0] ?? [] : [])
const bodyRows = computed(() => table.value.header ? grid.value.slice(1) : grid.value)

function rowStyle(row: number | null) {
  const height = row === null ? table.value.headerHeight : table.value.rowHeights?.[row] ?? null
  return height ? { height: `${height}px` } : undefined
}

function cellText(row: number, column: number) {
  return row === -1
    ? table.value.columns[column]?.label ?? ''
    : table.value.rows[row]?.[column] ?? ''
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
              {{ cellText(-1, cell.column) }}
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
              {{ cellText(rowIndex, cell.column) }}
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
.studio-table th { font-weight: 600; background: color-mix(in srgb, currentColor 7%, transparent); }
.studio-table--border th, .studio-table--border td { border: 1px solid color-mix(in srgb, currentColor 22%, transparent); }
.studio-table--striped tbody tr:nth-child(even) { background: color-mix(in srgb, currentColor 5%, transparent); }
</style>

<studio lang="yaml">
propsMode: declared
description: 纯文本单元格表格，可合并单元格并设置行列尺寸；列宽、对齐与表头在右侧编辑
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
  merges:
    hidden: true
  headerHeight:
    hidden: true
  rowHeights:
    hidden: true
</studio>
