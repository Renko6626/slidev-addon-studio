<script setup lang="ts">
import type { TableColumn } from '../shared/table'
import { computed } from 'vue'
import { normaliseTable } from '../shared/table'

const props = withDefaults(defineProps<{
  columns?: TableColumn[]
  rows?: string[][]
  header?: boolean
  border?: boolean
  striped?: boolean
  fontSize?: number
}>(), { columns: () => [], rows: () => [], header: true, border: true, striped: false })

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
  })
})
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
        <tr>
          <th
            v-for="(column, index) in table.columns"
            :key="index"
            :data-studio-table-cell="`-1,${index}`"
            :style="{ textAlign: column.align }"
          >
            {{ column.label }}
          </th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(row, rowIndex) in table.rows" :key="rowIndex">
          <td
            v-for="(cell, cellIndex) in row"
            :key="cellIndex"
            :data-studio-table-cell="`${rowIndex},${cellIndex}`"
            :style="{ textAlign: table.columns[cellIndex]?.align ?? 'left' }"
          >
            {{ cell }}
          </td>
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
description: 纯文本单元格表格，列宽、对齐与表头在右侧编辑
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
</studio>