import type { TableData } from '../../shared/table'

/** A header cell has no row; a body cell has a zero-based row. */
export interface TableCellPosition {
  row: number | null
  column: number
}

export function tableCellValue(table: TableData, position: TableCellPosition): string {
  if (position.row === null)
    return table.columns[position.column]?.label ?? ''
  return table.rows[position.row]?.[position.column] ?? ''
}

export function withTableCellValue(table: TableData, position: TableCellPosition, value: string): TableData {
  if (position.row === null) {
    return {
      ...table,
      columns: table.columns.map((column, index) => index === position.column ? { ...column, label: value } : column),
    }
  }
  return {
    ...table,
    rows: table.rows.map((row, rowIndex) => rowIndex === position.row
      ? row.map((cell, columnIndex) => columnIndex === position.column ? value : cell)
      : row),
  }
}

/** Tab order follows the rendered table: header row first, then body rows. */
export function tableCellSequence(table: TableData): TableCellPosition[] {
  const positions: TableCellPosition[] = []
  if (table.header) {
    for (let column = 0; column < table.columns.length; column++)
      positions.push({ row: null, column })
  }
  for (let row = 0; row < table.rows.length; row++) {
    for (let column = 0; column < table.columns.length; column++)
      positions.push({ row, column })
  }
  return positions
}

/** The next cell, `append-row` at the end, or null before the first cell. */
export function nextTableCell(table: TableData, position: TableCellPosition, direction: -1 | 1): TableCellPosition | 'append-row' | null {
  const sequence = tableCellSequence(table)
  const index = sequence.findIndex(cell => cell.row === position.row && cell.column === position.column)
  const next = (index === -1 ? 0 : index) + direction
  if (next < 0)
    return null
  if (next >= sequence.length)
    return direction === 1 ? 'append-row' : null
  return sequence[next]!
}

export function defaultTableCell(table: TableData): TableCellPosition | null {
  if (!table.columns.length)
    return null
  if (table.header)
    return { row: null, column: 0 }
  if (table.rows.length)
    return { row: 0, column: 0 }
  return null
}

/** Clamp a remembered cell after rows or columns were removed. */
export function clampTableCell(table: TableData, position: TableCellPosition): TableCellPosition | null {
  if (!table.columns.length)
    return null
  const column = Math.max(0, Math.min(position.column, table.columns.length - 1))
  if (position.row === null)
    return table.header ? { row: null, column } : { row: table.rows.length ? 0 : null, column }
  if (!table.rows.length)
    return table.header ? { row: null, column } : null
  return { row: Math.max(0, Math.min(position.row, table.rows.length - 1)), column }
}