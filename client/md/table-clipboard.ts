import type { TableData, TableRect } from '../../shared/table'
import { mergeAt, mergeIntersectsRect } from '../../shared/table'
import { cellHTMLFromText, flattenCellHTML } from '../../shared/table-html'

export function copyTableCells(table: TableData, rect: TableRect): string[][] {
  const rows: string[][] = []
  for (let row = rect.rowStart; row <= rect.rowEnd; row++) {
    const cells: string[] = []
    for (let column = rect.columnStart; column <= rect.columnEnd; column++) {
      const merge = mergeAt(table, row, column)
      const covered = merge && (merge.row !== row || merge.column !== column)
      const value = covered ? '' : (row === -1 ? table.columns[column]?.label : table.rows[row]?.[column]) ?? ''
      cells.push(table.rich ? flattenCellHTML(value) : value)
    }
    rows.push(cells)
  }
  return rows
}

export function encodeTableTSV(rows: string[][]): string {
  return rows.map(row => row.map(cell => (
    /[\t\r\n"]/.test(cell) || (cell === '' && row.length === 1)
      ? `"${cell.replace(/"/g, '""')}"`
      : cell
  )).join('\t')).join('\n')
}

/** Accept spreadsheet-style quotes, with a final record delimiter optional. */
export function decodeTableTSV(text: string): string[][] {
  const rows: string[][] = []
  const quoted = /"((?:[^"]|"")*)"(?=[\t\r\n]|$)/y
  const plain = /[^\t\r\n]*/y
  let row: string[] = []
  let index = 0
  for (;;) {
    quoted.lastIndex = plain.lastIndex = index
    const match = quoted.exec(text)
    const raw = match?.[0] ?? plain.exec(text)![0]
    row.push(match ? match[1].replace(/""/g, '"') : raw)
    index += raw.length
    const separator = text[index++]
    if (separator === '\t')
      continue
    rows.push(row)
    if (separator === '\r' && text[index] === '\n')
      index++
    if (index >= text.length)
      break
    row = []
  }
  const width = rows.reduce((width, row) => Math.max(width, row.length), 0)
  return rows.map(row => Array.from({ length: width }, (_, index) => row[index] ?? ''))
}

/** Overwrites the full rectangle at once and leaves existing merges in place. */
export function pasteTableCells(table: TableData, rowStart: number, columnStart: number, cells: string[][]): TableData | null {
  const rowEnd = rowStart + cells.length - 1
  const columnEnd = columnStart + cells[0].length - 1
  if (table.merges?.some(merge => mergeIntersectsRect(merge, { rowStart, rowEnd, columnStart, columnEnd })))
    return null

  const width = Math.max(table.columns.length, columnEnd + 1)
  const columns = Array.from({ length: width }, (_, index) => ({ ...table.columns[index], label: table.columns[index]?.label ?? '' }))
  const rows = Array.from({ length: Math.max(table.rows.length, rowEnd + 1) }, (_, row) =>
    Array.from({ length: width }, (_, column) => table.rows[row]?.[column] ?? ''),
  )
  for (const [rowOffset, values] of cells.entries()) {
    const row = rowStart + rowOffset
    for (const [columnOffset, text] of values.entries()) {
      const column = columnStart + columnOffset
      const value = table.rich ? cellHTMLFromText(text) : text
      if (row === -1)
        columns[column].label = value
      else
        rows[row][column] = value
    }
  }
  return { ...table, columns, rows }
}
