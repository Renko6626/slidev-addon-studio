import { expect, it } from 'vitest'
import type { SourceRange } from '../client/types'
import type { TableData } from '../shared/table'
import { addColumn, addRow, moveColumn, moveRow, normaliseTable, removeColumn, removeRow, DEFAULT_TABLE_SNIPPET } from '../shared/table'
import { endOfBlock } from '../client/md/lines'
import { formatStringMatrix, parseStringMatrix } from '../client/md/literals'
import { formatTableColumns, parseTableColumns, readTable, tableSnippet, writeTable, writeTableStyle } from '../client/md/table'

function rangeOf(content: string): SourceRange {
  const lines = content.split('\n')
  const start = lines.findIndex(line => line.trim().startsWith('<StudioTable'))
  expect(start).toBeGreaterThanOrEqual(0)
  return [start, endOfBlock(lines, start)]
}

function roundTrip(content: string, table: TableData) {
  const next = writeTable(content, rangeOf(content), table)
  return { next, read: readTable(next, rangeOf(next)) }
}

const base = `<StudioTable
  :columns="[
    { label: '项目' },
  ]"
  :rows="[
    ['A'],
  ]"
/>

Paragraph`

it('reads an omitted table as empty with defaults', () => {
  const { table, explicit, unparsed } = readTable('<StudioTable />', [0, 1])
  expect({ explicit, unparsed }).toEqual({ explicit: false, unparsed: false })
  expect(table).toEqual({ columns: [], rows: [], header: true, border: true, striped: false })
})

it('round-trips cells, quotes, entities, newlines and empty strings', () => {
  const table: TableData = {
    columns: [{ label: '项目' }, { label: '数值', align: 'right', width: 30 }],
    rows: [['', '含 \'引号\' & <尖括号>'], ['A', '第一行\n第二行'], ['', '']],
    header: true,
    border: true,
    striped: false,
  }
  const { next, read } = roundTrip(base, table)
  expect(next).toContain('&amp; &lt;尖括号&gt;')
  expect(read.unparsed).toBe(false)
  expect(read.table.rows).toEqual(table.rows)
  expect(read.table.columns).toEqual(table.columns.map(column => ({ ...column, align: column.align ?? 'left' })))
})

it('keeps other attributes and writes styling untouched', () => {
  const content = `<StudioTable
  v-drag="[10,20,300,_]"
  header
  striped
  :columns="[{ label: 'A' }]"
  :rows="[['1']]"
/>`
  const { next, read } = roundTrip(content, { columns: [{ label: 'B' }, { label: 'C' }], rows: [['2', '3']], header: true, border: true, striped: true })
  expect(next).toContain('v-drag="[10,20,300,_]"')
  expect(next).toContain('\n  header')
  expect(read.table.striped).toBe(true)
  expect(read.table.columns.map(column => column.label)).toEqual(['B', 'C'])
})

it('reads a table that only declares rows by deriving empty columns', () => {
  const content = `<StudioTable :rows="[['a', 'b'], ['c', 'd']]" />`
  const { table, explicit, unparsed } = readTable(content, [0, 1])
  expect({ explicit, unparsed }).toEqual({ explicit: true, unparsed: false })
  expect(table.columns).toEqual([{ label: '', align: 'left', width: undefined }, { label: '', align: 'left', width: undefined }])
  expect(table.rows).toEqual([['a', 'b'], ['c', 'd']])
})

it('reports unreadable props instead of rewriting them', () => {
  for (const content of [
    '<StudioTable :rows="[1, 2]" />',
    '<StudioTable columns="A,B" />',
    '<StudioTable :rows="[{ a: 1 }]" />',
    '<StudioTable v-bind="props" />',
    '<StudioTable :columns="[{ label: \'A\' }]" :columns="[{ label: \'B\' }]" />',
  ]) {
    const { unparsed } = readTable(content, [0, 1])
    expect(unparsed, content).toBe(true)
  }
})

it('parses and formats columns without losing empty labels', () => {
  const columns = [
    { label: '' },
    { label: '数值', align: 'center' as const, width: 25.5 },
  ]
  const formatted = formatTableColumns(columns)
  expect(parseTableColumns(formatted)).toEqual(columns)
  expect(parseTableColumns('[{"label": "A"}]')).toEqual([{ label: 'A' }])
  expect(parseTableColumns('[{ label: \'A\', extra: 1 }]')).toBeNull()
})

it('keeps the block boundary around a multiline tag', () => {
  const lines = base.split('\n')
  expect(endOfBlock(lines, 0)).toBe(8)
})

it('formatting rows preserves empty strings', () => {
  const rows = [['', 'a'], ['', '']]
  expect(parseStringMatrix(formatStringMatrix(rows))).toEqual(rows)
  expect(parseStringMatrix('[[1]]')).toBeNull()
})

it('row and column operations keep a rectangular table', () => {
  const table: TableData = { columns: [{ label: 'A' }, { label: 'B' }], rows: [['1', '2']], header: true, border: true, striped: false }
  expect(addRow(table).rows).toEqual([['1', '2'], ['', '']])
  expect(removeRow(addRow(table), 0).rows).toEqual([['', '']])
  expect(addColumn(table).columns.map(column => column.label)).toEqual(['A', 'B', ''])
  expect(addColumn(table).rows[0]).toEqual(['1', '2', ''])
  expect(removeColumn(addColumn(table), 1).rows[0]).toEqual(['1', ''])
  expect(moveColumn(table, 0, 1).columns.map(column => column.label)).toEqual(['B', 'A'])
  expect(moveRow(addRow(table), 1, -1).rows).toEqual([['', ''], ['1', '2']])
  expect(normaliseTable({ ...table, rows: [['1']] }).rows).toEqual([['1', '']])
})

it('the default and imported snippets parse back', () => {
  for (const snippet of [DEFAULT_TABLE_SNIPPET, tableSnippet({ columns: [{ label: 'A' }], rows: [['1']], header: false, border: true, striped: true })]) {
    const { table, unparsed } = readTable(snippet, [0, snippet.split('\n').length])
    expect(unparsed).toBe(false)
    expect(table.rows.length).toBeGreaterThan(0)
  }
})

it('writes one column and row per line, not encoded newlines', () => {
  const next = writeTable('<StudioTable :columns="[]" :rows="[]" />', [0, 1], {
    columns: [{ label: 'A' }, { label: 'B' }],
    rows: [['1', '2'], ['3', '4']],
    header: true,
    border: true,
    striped: false,
  })
  expect(next).toContain(':columns="[\n')
  expect(next).toContain(':rows="[\n')
  expect(next).not.toContain('&#10;')
})

it('writes presentation props without touching the data', () => {
  const content = '<StudioTable :columns="[{ label: \'A\' }]" :rows="[[\'1\']]" />'
  const next = writeTableStyle(content, [0, 1], { header: false, border: false, striped: true, fontSize: 18 })
  const { table, unparsed } = readTable(next, [0, 1])
  expect(unparsed).toBe(false)
  expect(table).toMatchObject({ header: false, border: false, striped: true, fontSize: 18 })
  expect(table.rows).toEqual([['1']])
})

it('leaves dynamic style props alone when another style changes', () => {
  const content = '<StudioTable :columns="[{ label: \'A\' }]" :rows="[[\'1\']]" :header="showHeader" font-size="1.2em" />'
  const next = writeTableStyle(content, [0, 1], { striped: true })
  expect(next).toContain(':header="showHeader"')
  expect(next).toContain('font-size="1.2em"')
})

it('refuses to truncate a row wider than the columns', () => {
  const { unparsed } = readTable('<StudioTable :columns="[{ label: \'A\' }]" :rows="[[\'1\', \'2\']]" />', [0, 1])
  expect(unparsed).toBe(true)
})