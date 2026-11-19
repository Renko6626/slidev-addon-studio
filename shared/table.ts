/** Shared table shapes and pure row/column operations. */

export type TableAlign = 'left' | 'center' | 'right'

export interface TableColumn {
  label: string
  align?: TableAlign
  /** Share of the table width in percent; omitted means equal columns. */
  width?: number
}

export interface TableData {
  columns: TableColumn[]
  rows: string[][]
  header: boolean
  border: boolean
  striped: boolean
  fontSize?: number
}

export const TABLE_DEFAULTS = { header: true, border: true, striped: false } as const

export const DEFAULT_TABLE_SNIPPET = `<StudioTable :columns="[{ label: '列 1' }, { label: '列 2' }, { label: '列 3' }]" :rows="[['', '', ''], ['', '', '']]" />`

export function normaliseTable(table: TableData): TableData {
  const columns = table.columns.map(column => ({
    label: column.label ?? '',
    align: column.align === 'center' || column.align === 'right' ? column.align : 'left' as const,
    width: typeof column.width === 'number' && Number.isFinite(column.width) && column.width > 0 ? column.width : undefined,
  }))
  return {
    columns,
    rows: table.rows.map(row => columns.map((_, index) => row[index] ?? '')),
    header: table.header,
    border: table.border,
    striped: table.striped,
    fontSize: typeof table.fontSize === 'number' && Number.isFinite(table.fontSize) && table.fontSize > 0 ? table.fontSize : undefined,
  }
}

export function addRow(table: TableData, at = table.rows.length): TableData {
  const rows = table.rows.slice()
  rows.splice(Math.max(0, Math.min(at, rows.length)), 0, table.columns.map(() => ''))
  return { ...table, rows }
}

export function removeRow(table: TableData, index: number): TableData {
  if (index < 0 || index >= table.rows.length)
    return table
  const rows = table.rows.slice()
  rows.splice(index, 1)
  return { ...table, rows }
}

export function moveRow(table: TableData, index: number, direction: -1 | 1): TableData {
  const target = index + direction
  if (index < 0 || index >= table.rows.length || target < 0 || target >= table.rows.length)
    return table
  const rows = table.rows.slice()
  const [row] = rows.splice(index, 1)
  rows.splice(target, 0, row!)
  return { ...table, rows }
}

export function addColumn(table: TableData, at = table.columns.length, column: TableColumn = { label: '' }): TableData {
  const index = Math.max(0, Math.min(at, table.columns.length))
  const columns = table.columns.slice()
  columns.splice(index, 0, { ...column })
  const rows = table.rows.map(row => {
    const next = row.slice()
    next.splice(index, 0, '')
    return next
  })
  return { ...table, columns, rows }
}

export function removeColumn(table: TableData, index: number): TableData {
  if (index < 0 || index >= table.columns.length)
    return table
  return {
    ...table,
    columns: table.columns.filter((_, position) => position !== index),
    rows: table.rows.map(row => row.filter((_, position) => position !== index)),
  }
}

export function moveColumn(table: TableData, index: number, direction: -1 | 1): TableData {
  const target = index + direction
  if (index < 0 || index >= table.columns.length || target < 0 || target >= table.columns.length)
    return table
  const columns = table.columns.slice()
  const [column] = columns.splice(index, 1)
  columns.splice(target, 0, column!)
  return {
    ...table,
    columns,
    rows: table.rows.map((row) => {
      const cells = row.slice()
      const [cell] = cells.splice(index, 1)
      cells.splice(target, 0, cell!)
      return cells
    }),
  }
}