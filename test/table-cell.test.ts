import { expect, it } from 'vitest'
import type { TableData } from '../shared/table'
import { clampTableCell, defaultTableCell, nextTableCell, tableCellSequence, tableCellValue, withTableCellValue } from '../client/md/table-cell'

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