import { expect, it } from 'vitest'
import type { TableData } from '../shared/table'
import { anchorTableCell, clampTableCell, defaultTableCell, nextTableCell, tableCellSequence, tableCellValue, tableRectBetween, tableRectIsFree, withTableCellValue } from '../client/md/table-cell'

const table: TableData = {
  columns: [{ label: 'A' }, { label: 'B' }],
  rows: [['1', '2'], ['3', '4']],
  header: true,
  border: true,
  striped: false,
}

it('reads and writes header and body cells without mutating the table', () => {
  expect(tableCellValue(table, { row: null, column: 1 })).toBe('B')
  expect(tableCellValue(table, { row: 1, column: 0 })).toBe('3')
  const header = withTableCellValue(table, { row: null, column: 0 }, 'Name')
  expect(header.columns[0].label).toBe('Name')
  expect(table.columns[0].label).toBe('A')
  const body = withTableCellValue(table, { row: 0, column: 1 }, '9')
  expect(body.rows[0][1]).toBe('9')
  expect(table.rows[0][1]).toBe('2')
})

it('orders header cells first when the header is shown', () => {
  expect(tableCellSequence(table)).toEqual([
    { row: null, column: 0 }, { row: null, column: 1 },
    { row: 0, column: 0 }, { row: 0, column: 1 },
    { row: 1, column: 0 }, { row: 1, column: 1 },
  ])
  expect(tableCellSequence({ ...table, header: false })).toHaveLength(4)
})

it('moves forward, backward and asks to append after the last cell', () => {
  expect(nextTableCell(table, { row: null, column: 0 }, 1)).toEqual({ row: null, column: 1 })
  expect(nextTableCell(table, { row: null, column: 1 }, 1)).toEqual({ row: 0, column: 0 })
  expect(nextTableCell(table, { row: 1, column: 1 }, 1)).toBe('append-row')
  expect(nextTableCell(table, { row: 1, column: 0 }, -1)).toEqual({ row: 0, column: 1 })
  expect(nextTableCell(table, { row: null, column: 0 }, -1)).toBeNull()
})

it('clamps a remembered cell after columns or rows are removed', () => {
  expect(clampTableCell(table, { row: 9, column: 9 })).toEqual({ row: 1, column: 1 })
  expect(clampTableCell({ ...table, rows: [] }, { row: 0, column: 1 })).toEqual({ row: null, column: 1 })
  expect(clampTableCell({ ...table, header: false, rows: [] }, { row: 0, column: 1 })).toBeNull()
  expect(clampTableCell({ ...table, columns: [] }, { row: 0, column: 0 })).toBeNull()
  expect(defaultTableCell(table)).toEqual({ row: null, column: 0 })
})
const merged: TableData = {
  columns: [{ label: 'A' }, { label: 'B' }, { label: 'C' }],
  rows: [['1', '2', '3'], ['4', '5', '6'], ['7', '8', '9']],
  header: true,
  border: true,
  striped: false,
  merges: [{ row: 0, column: 0, rowspan: 2, colspan: 2 }],
}

it('follows a merged region when reading and writing cells', () => {
  expect(anchorTableCell(merged, { row: 1, column: 1 })).toEqual({ row: 0, column: 0 })
  expect(tableCellValue(merged, { row: 1, column: 1 })).toBe('1')
  const next = withTableCellValue(merged, { row: 1, column: 1 }, '9')
  expect(next.rows[0][0]).toBe('9')
  expect(merged.rows[0][0]).toBe('1')
})

it('skips covered cells in Tab order and clamps into the anchor', () => {
  expect(tableCellSequence(merged)).toEqual([
    { row: null, column: 0 }, { row: null, column: 1 }, { row: null, column: 2 },
    { row: 0, column: 0 }, { row: 0, column: 2 },
    { row: 1, column: 2 },
    { row: 2, column: 0 }, { row: 2, column: 1 }, { row: 2, column: 2 },
  ])
  expect(clampTableCell(merged, { row: 1, column: 1 })).toEqual({ row: 0, column: 0 })
  expect(nextTableCell(merged, { row: 0, column: 0 }, 1)).toEqual({ row: 0, column: 2 })
})

it('builds merge rectangles only inside one region', () => {
  expect(tableRectBetween(merged, { row: null, column: 0 }, { row: null, column: 2 }))
    .toEqual({ rowStart: -1, rowEnd: -1, columnStart: 0, columnEnd: 2 })
  expect(tableRectBetween(merged, { row: null, column: 0 }, { row: 0, column: 1 })).toBeNull()
  expect(tableRectBetween(merged, { row: 2, column: 0 }, { row: 0, column: 1 }))
    .toEqual({ rowStart: 0, rowEnd: 2, columnStart: 0, columnEnd: 0 })
  expect(tableRectBetween(merged, { row: 2, column: 0 }, { row: 0, column: 2 }))
    .toEqual({ rowStart: 0, rowEnd: 2, columnStart: 0, columnEnd: 2 })
  expect(tableRectBetween(merged, { row: 2, column: 0 }, { row: 2, column: 0 })).toBeNull()
  expect(tableRectBetween(merged, { row: 0, column: 1 }, { row: 1, column: 1 })).toBeNull()
})

it('reports whether a rectangle can be merged as-is', () => {
  expect(tableRectIsFree(merged, { rowStart: 0, rowEnd: 1, columnStart: 0, columnEnd: 1 })).toBe(false)
  expect(tableRectIsFree(merged, { rowStart: 0, rowEnd: 1, columnStart: 2, columnEnd: 2 })).toBe(true)
  expect(tableRectIsFree(merged, { rowStart: -1, rowEnd: -1, columnStart: 0, columnEnd: 2 })).toBe(true)
})

it('treats a rectangle that only clips a merge anchor as unavailable', () => {
  const table: TableData = {
    columns: [{ label: 'A' }, { label: 'B' }, { label: 'C' }],
    rows: [['1', '2', '3']],
    header: false,
    border: true,
    striped: false,
    merges: [{ row: 0, column: 1, rowspan: 1, colspan: 2 }],
  }
  expect(tableRectIsFree(table, { rowStart: 0, rowEnd: 0, columnStart: 0, columnEnd: 1 })).toBe(false)
  expect(tableRectIsFree(table, { rowStart: 0, rowEnd: 0, columnStart: 0, columnEnd: 0 })).toBe(true)
})
