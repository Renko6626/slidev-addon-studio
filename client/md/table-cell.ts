import type { TableData, TableRect } from '../../shared/table'
import { anchorOf, resolveTableGrid } from '../../shared/table'

/** A header cell has no row; a body cell has a zero-based row. */
export interface TableCellPosition {
  row: number | null
  column: number
}

function storedRow(row: number | null) {
  return row === null ? -1 : row
}

/** Maps a covered position to the cell that actually draws the merged region. */
export function anchorTableCell(table: TableData, position: TableCellPosition): TableCellPosition {
  const anchor = anchorOf(table, storedRow(position.row), position.column)
  return { row: anchor.row === -1 ? null : anchor.row, column: anchor.column }
}

export function tableCellValue(table: TableData, position: TableCellPosition): string {
  const anchor = anchorTableCell(table, position)
  if (anchor.row === null)
    return table.columns[anchor.column]?.label ?? ''
  return table.rows[anchor.row]?.[anchor.column] ?? ''
}

export function withTableCellValue(table: TableData, position: TableCellPosition, value: string): TableData {
  const anchor = anchorTableCell(table, position)
  if (anchor.row === null) {
    return {
      ...table,
      columns: table.columns.map((column, index) => index === anchor.column ? { ...column, label: value } : column),
    }
  }
  return {
    ...table,
    rows: table.rows.map((row, rowIndex) => rowIndex === anchor.row
      ? row.map((cell, columnIndex) => columnIndex === anchor.column ? value : cell)
      : row),
  }
}

/** Tab order follows the rendered table: header row first, then body rows. */
export function tableCellSequence(table: TableData): TableCellPosition[] {
  const positions: TableCellPosition[] = []
  for (const row of resolveTableGrid(table)) {
    for (const cell of row) {
      if (!cell.covered)
        positions.push({ row: cell.row === -1 ? null : cell.row, column: cell.column })
    }
  }
  return positions
}

/** The next cell, `append-row` at the end, or null before the first cell. */
export function nextTableCell(table: TableData, position: TableCellPosition, direction: -1 | 1): TableCellPosition | 'append-row' | null {
  const sequence = tableCellSequence(table)
  const current = anchorTableCell(table, position)
  const index = sequence.findIndex(cell => cell.row === current.row && cell.column === current.column)
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

/** Clamp a remembered cell after rows or columns were removed, then follow a merge. */
export function clampTableCell(table: TableData, position: TableCellPosition): TableCellPosition | null {
  if (!table.columns.length)
    return null
  const column = Math.max(0, Math.min(position.column, table.columns.length - 1))
  if (position.row === null) {
    const clamped = table.header ? { row: null, column } : { row: table.rows.length ? 0 : null, column }
    return clamped.row === null && !table.header ? null : anchorTableCell(table, clamped)
  }
  if (!table.rows.length)
    return table.header ? anchorTableCell(table, { row: null, column }) : null
  return anchorTableCell(table, { row: Math.max(0, Math.min(position.row, table.rows.length - 1)), column })
}

/** The rectangle between two positions; only cells in the same region can mix. */
export function tableRectBetween(table: TableData, from: TableCellPosition, to: TableCellPosition): TableRect | null {
  if (from.column === to.column && from.row === to.row)
    return null
  const header = from.row === null && to.row === null
  if ((from.row === null) !== (to.row === null))
    return null
  if (!header && (from.row === null || to.row === null))
    return null
  const a = anchorTableCell(table, from)
  const b = anchorTableCell(table, to)
  if (a.row === null && !table.header)
    return null
  const rowStart = Math.min(storedRow(a.row), storedRow(b.row))
  const rowEnd = Math.max(storedRow(a.row), storedRow(b.row))
  const columnStart = Math.min(a.column, b.column)
  const columnEnd = Math.max(a.column, b.column)
  if (rowStart === rowEnd && columnStart === columnEnd)
    return null
  return { rowStart, rowEnd, columnStart, columnEnd }
}

/** Whether the rectangle can be merged without touching an existing merge. */
export function tableRectIsFree(table: TableData, rect: TableRect): boolean {
  return !(table.merges ?? []).some(merge => merge.row < rect.rowEnd + 1 && rect.rowStart < merge.row + merge.rowspan
    && merge.column < rect.columnEnd + 1 && rect.columnStart < merge.column + merge.colspan)
}
