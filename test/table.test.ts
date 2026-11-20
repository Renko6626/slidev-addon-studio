// @vitest-environment jsdom
import { expect, it } from 'vitest'
import type { SourceRange } from '../client/types'
import type { TableData } from '../shared/table'
import { addColumn, addRow, clearColumnWidths, mergeTableRange, moveColumn, moveRow, normaliseTable, removeColumn, removeRow, resolveTableGrid, resizeColumnWidths, splitTableMerge, withRowHeight, DEFAULT_TABLE_SNIPPET } from '../shared/table'
import { endOfBlock } from '../client/md/lines'
import { formatStringMatrix, parseStringMatrix } from '../client/md/literals'
import { formatTableColumns, parseTableColumns, readTable, tableSnippet, writeTable, writeTableStyle } from '../client/md/table'
import { withTableCellValue } from '../client/md/table-cell'

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

it('leaves interpolated strings and sparse table data to source editing', () => {
  const cases = [
    ':rows="[[`Total: ${total}`]]"',
    ':rows="[[, \'second\']]"',
    ':rows="[, [\'second\']]"',
    ':columns="[, { label: \'B\' }]"',
    ':rows="[[\'first\'], [\'second\']]" :row-heights="[, 40]"',
    ':rows="[[\'first\']]" :[prop]="customValue"',
  ]
  for (const attrs of cases)
    expect(readTable(`<StudioTable ${attrs} />`, [0, 1]).unparsed, attrs).toBe(true)
})

it('keeps escaped characters in untouched labels and cells when editing another cell', () => {
  const content = String.raw`<StudioTable :columns="[{ label: '\u9879\u{76EE}' }, { label: 'B' }]" :rows="[['\x41\u{1F600}', 'old']]" />`
  const before = readTable(content, [0, 1])
  expect(before.unparsed).toBe(false)
  const edited = withTableCellValue(before.table, { row: 0, column: 1 }, 'new')
  const { read } = roundTrip(content, edited)
  expect(read.unparsed).toBe(false)
  expect(read.table.columns[0].label).toBe('项目')
  expect(read.table.rows).toEqual([['A😀', 'new']])
})

it('decodes authored HTML character references in bound table props once', () => {
  const content = '<StudioTable :columns="[{ label: \'A&nbsp;B\' }, { label: \'C\' }]" :rows="[[\'&#x4E2D; &amp;nbsp;\', \'old\']]" />'
  const before = readTable(content, [0, 1])
  expect(before.unparsed).toBe(false)
  const edited = withTableCellValue(before.table, { row: 0, column: 1 }, 'new')
  const { read } = roundTrip(content, edited)
  expect(read.table.columns[0].label).toBe('A\u00a0B')
  expect(read.table.rows).toEqual([['中 &nbsp;', 'new']])
})

it('reads Boolean props using the same empty and bound values as the component', () => {
  const content = '<StudioTable :rows="[[\'cell\']]" header="" rich="" :border=" false " />'
  const { table, unparsed } = readTable(content, [0, 1])
  expect(unparsed).toBe(false)
  expect(table).toMatchObject({ header: true, rich: true, border: false })
  for (const attrs of [':header="showHeader"', ':rich', ':rich="false" rich'])
    expect(readTable(`<StudioTable :rows="[['cell']]" ${attrs} />`, [0, 1]).unparsed, attrs).toBe(true)
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

it('includes the configured merges and sizes in a newly written snippet', () => {
  const table = normaliseTable({
    ...gridTable(),
    merges: [{ row: 0, column: 1, rowspan: 2, colspan: 1 }],
    headerHeight: 44,
    rowHeights: [null, 56],
  })
  const content = tableSnippet(table)
  expect(readTable(content, rangeOf(content))).toMatchObject({ table, unparsed: false })
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

it('keeps a table inside its Markdown list item when writing column widths', () => {
  const table = gridTable()
  const indent = '  '
  const block = tableSnippet(table).replace(/^/gm, indent)
  const content = `- Item\n\n${block}\n\n  # Neighbor`
  const { next, read } = roundTrip(content, {
    ...table,
    columns: table.columns.map((column, index) => index === 0 ? { ...column, width: 40 } : column),
  })
  const [start, end] = rangeOf(next)
  const lines = next.split('\n')
  expect(lines.slice(0, start)).toEqual(['- Item', ''])
  expect(lines.slice(start, end).every(line => line.startsWith(indent))).toBe(true)
  expect(lines.slice(end)).toEqual(['', '  # Neighbor'])
  expect(read).toMatchObject({ unparsed: false, table: { columns: [{ label: 'A', width: 40 }, { label: 'B' }, { label: 'C' }], rows: table.rows } })
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
function gridTable(): TableData {
  return normaliseTable({
    columns: [{ label: 'A' }, { label: 'B' }, { label: 'C' }],
    rows: [['1', '2', '3'], ['4', '5', '6'], ['7', '8', '9']],
    header: true,
    border: true,
    striped: false,
  })
}

it('round-trips merges, row heights and the header height', () => {
  const content = `<StudioTable
  :columns="[
    { label: 'A' },
    { label: 'B' },
  ]"
  :rows="[
    ['1', '2'],
  ]"
/>`
  const table: TableData = {
    columns: [{ label: 'A' }, { label: 'B' }],
    rows: [['1', '2'], ['3', '4'], ['5', '6']],
    header: true,
    border: true,
    striped: false,
    merges: [{ row: 0, column: 0, rowspan: 2, colspan: 2 }],
    rowHeights: [56, null, 72],
    headerHeight: 40,
  }
  const next = writeTable(content, rangeOf(content), table)
  expect(next).toContain(':merges="')
  expect(next).toContain('rowspan: 2')
  expect(next).toContain('colspan: 2')
  expect(next).toContain(':row-heights="[56, null, 72]"')
  expect(next).toContain(':header-height="40"')
  const read = readTable(next, rangeOf(next))
  expect(read.unparsed).toBe(false)
  expect(read.table.merges).toEqual(table.merges)
  expect(read.table.rowHeights).toEqual(table.rowHeights)
  expect(read.table.headerHeight).toBe(40)
})

it('round-trips a header merge without a rowspan', () => {
  const table = normaliseTable({
    ...gridTable(),
    merges: [{ row: -1, column: 1, rowspan: 1, colspan: 2 }],
  })
  const next = writeTable('<StudioTable />', [0, 1], table)
  expect(next).toContain('row: -1')
  expect(next).not.toContain('rowspan')
  const read = readTable(next, [0, next.split('\n').length])
  expect(read.unparsed).toBe(false)
  expect(read.table.merges).toEqual([{ row: -1, column: 1, rowspan: 1, colspan: 2 }])
})

it('removes optional props when the table no longer needs them', () => {
  const content = `<StudioTable
  :columns="[{ label: 'A' }]"
  :rows="[['1'], ['2']]"
  :merges="[{ row: 0, column: 0, rowspan: 2, colspan: 1 }]"
  :row-heights="[40]"
  :header-height="30"
/>`
  const table: TableData = { columns: [{ label: 'A' }], rows: [['1'], ['2']], header: true, border: true, striped: false }
  const next = writeTable(content, rangeOf(content), table)
  expect(next).not.toContain(':merges')
  expect(next).not.toContain(':row-heights')
  expect(next).not.toContain(':header-height')
})

it('marks malformed merges and heights as unparsed', () => {
  const two = '<StudioTable :columns="[{ label: \'A\' }, { label: \'B\' }]" :rows="[[\'1\', \'2\']]"'
  const three = '<StudioTable :columns="[{ label: \'A\' }, { label: \'B\' }, { label: \'C\' }]" :rows="[[\'1\', \'2\', \'3\']]"'
  const cases: [string, string][] = [
    [two, ' :merges="[{ row: 0, column: 0, rowspan: 2 }]"'],
    [two, ' :merges="[{ row: 0, column: 0, extra: 1 }]"'],
    [two, ' :merges="merged"'],
    [two, ' merges="[]"'],
    [three, ' :merges="[{ row: 0, column: 0, colspan: 2 }, { row: 0, column: 1, colspan: 2 }]"'],
    [two, ' :row-heights="[40, 50]"'],
    [two, ' :row-heights="[0]"'],
    [two, ' :header-height="0"'],
    [two, ' :header-height="tall"'],
  ]
  for (const [base, attrs] of cases)
    expect(readTable(`${base}${attrs} />`, [0, 1]).unparsed, attrs).toBe(true)
})

it('keeps merges consistent when rows and columns change', () => {
  const table = normaliseTable({ ...gridTable(), merges: [{ row: 0, column: 0, rowspan: 2, colspan: 2 }] })
  expect(addRow(table, 1).merges).toEqual([{ row: 0, column: 0, rowspan: 3, colspan: 2 }])
  expect(addRow(table, 0).merges).toEqual([{ row: 1, column: 0, rowspan: 2, colspan: 2 }])
  expect(removeRow(table, 0).merges).toEqual([{ row: 0, column: 0, rowspan: 1, colspan: 2 }])
  expect(removeRow(table, 1).merges).toEqual([{ row: 0, column: 0, rowspan: 1, colspan: 2 }])
  expect(addColumn(table, 0).merges).toEqual([{ row: 0, column: 1, rowspan: 2, colspan: 2 }])
  expect(addColumn(table, 1).merges).toEqual([{ row: 0, column: 0, rowspan: 2, colspan: 3 }])
  expect(removeColumn(table, 0).merges).toEqual([{ row: 0, column: 0, rowspan: 2, colspan: 1 }])
  expect(removeColumn(table, 1).merges).toEqual([{ row: 0, column: 0, rowspan: 2, colspan: 1 }])
  expect(moveRow(table, 0, 1)).toBe(table)
  expect(moveColumn(table, 0, 1)).toBe(table)
})

it('moves row heights with their rows', () => {
  const table = normaliseTable({ ...gridTable(), rowHeights: [30, null, 50], headerHeight: 40 })
  expect(addRow(table, 1).rowHeights).toEqual([30, null, null, 50])
  expect(removeRow(table, 0).rowHeights).toEqual([null, 50])
  expect(moveRow(table, 0, 1).rowHeights).toEqual([null, 30, 50])
  expect(withRowHeight(table, 1, 64).rowHeights).toEqual([30, 64, 50])
  expect(withRowHeight(table, null, 36).headerHeight).toBe(36)
  expect(withRowHeight(table, -1, 36).headerHeight).toBe(36)
  expect(withRowHeight(withRowHeight(table, 1, 64), 1, null).rowHeights).toEqual([30, null, 50])
})

it('merges a rectangle, clears covered cells and splits it again', () => {
  const table = gridTable()
  const merged = mergeTableRange(table, { rowStart: 0, rowEnd: 1, columnStart: 0, columnEnd: 1 })
  expect(merged.merges).toEqual([{ row: 0, column: 0, rowspan: 2, colspan: 2 }])
  expect(merged.rows).toEqual([['1', '', '3'], ['', '', '6'], ['7', '8', '9']])

  const grid = resolveTableGrid(merged)
  expect(grid[1][0]).toMatchObject({ row: 0, column: 0, rowspan: 2, colspan: 2, covered: false })
  expect(grid[1][1].covered).toBe(true)
  expect(grid[2][0].covered).toBe(true)
  expect(grid[2][1].covered).toBe(true)

  expect(mergeTableRange(merged, { rowStart: 1, rowEnd: 2, columnStart: 1, columnEnd: 2 })).toBe(merged)
  expect(mergeTableRange(table, { rowStart: -1, rowEnd: 0, columnStart: 0, columnEnd: 1 })).toBe(table)
  expect(mergeTableRange(table, { rowStart: 0, rowEnd: 0, columnStart: 0, columnEnd: 0 })).toBe(table)

  const split = splitTableMerge(merged, 1, 1)
  expect(split.merges).toBeUndefined()
  expect(split.rows[0]).toEqual(['1', '', '3'])

  const head = mergeTableRange(table, { rowStart: -1, rowEnd: -1, columnStart: 0, columnEnd: 2 })
  expect(head.merges).toEqual([{ row: -1, column: 0, rowspan: 1, colspan: 3 }])
  expect(head.columns.map(column => column.label)).toEqual(['A', '', ''])
})

it('resizes a column boundary while keeping the total width', () => {
  expect(resizeColumnWidths([50, 50], 0, 10)).toEqual([60, 40])
  expect(resizeColumnWidths([50, 50], 0, 60)).toEqual([95, 5])
  expect(resizeColumnWidths([20, 60, 20], 1, -10)).toEqual([20, 50, 30])
  expect(resizeColumnWidths([20, 60, 20], 2, 10)).toEqual([20, 60, 20])
  expect(resizeColumnWidths([100], 0, 10)).toEqual([100])
})

it('does not jump a column that is already below the minimum', () => {
  expect(resizeColumnWidths([2, 98], 0, -2)).toEqual([2, 98])
  expect(resizeColumnWidths([98, 2], 0, 10)).toEqual([98, 2])
  expect(resizeColumnWidths([2, 98], 0, 10)).toEqual([12, 88])
})

it('clears the two columns beside a boundary', () => {
  const columns = [{ label: 'A', width: 20 }, { label: 'B', width: 30 }, { label: 'C', width: 50 }]
  expect(clearColumnWidths(columns, 0)).toEqual([
    { label: 'A', width: undefined },
    { label: 'B', width: undefined },
    { label: 'C', width: 50 },
  ])
  expect(clearColumnWidths(columns, 5)).toBe(columns)
})

it('refuses moving any line that touches a merge', () => {
  const vertical = normaliseTable({ ...gridTable(), merges: [{ row: 0, column: 1, rowspan: 2, colspan: 1 }] })
  expect(moveColumn(vertical, 1, 1)).toBe(vertical)
  expect(moveColumn(vertical, 1, -1)).toBe(vertical)

  const horizontal = normaliseTable({ ...gridTable(), merges: [{ row: 0, column: 0, rowspan: 1, colspan: 2 }] })
  expect(moveRow(horizontal, 0, 1)).toBe(horizontal)
  expect(moveColumn(horizontal, 0, 1)).toBe(horizontal)

  const aside = normaliseTable({ ...gridTable(), merges: [{ row: 0, column: 1, rowspan: 1, colspan: 2 }] })
  expect(moveColumn(aside, 0, 1)).toBe(aside)
})

it('keeps merges and heights when a cell is edited', () => {
  const table = normaliseTable({
    ...gridTable(),
    merges: [{ row: 0, column: 0, rowspan: 2, colspan: 2 }],
    rowHeights: [30, null, 50],
    headerHeight: 40,
  })
  const edited = withTableCellValue(table, { row: 1, column: 1 }, 'x')
  const content = writeTable('<StudioTable />', [0, 1], edited)
  const read = readTable(content, [0, content.split('\n').length])
  expect(read.unparsed).toBe(false)
  expect(read.table.rows[0][0]).toBe('x')
  expect(read.table.merges).toEqual([{ row: 0, column: 0, rowspan: 2, colspan: 2 }])
  expect(read.table.rowHeights).toEqual([30, null, 50])
  expect(read.table.headerHeight).toBe(40)
})

it('keeps a header merge dormant when the header is hidden', () => {
  const content = '<StudioTable :header="false" :columns="[{ label: \'A\' }, { label: \'B\' }]" :rows="[[\'1\', \'2\']]" :merges="[{ row: -1, column: 0, colspan: 2 }]" />'
  const read = readTable(content, [0, 1])
  expect(read.unparsed).toBe(false)
  expect(read.table.merges).toEqual([{ row: -1, column: 0, rowspan: 1, colspan: 2 }])
  const next = writeTable(content, [0, 1], read.table)
  expect(next).toContain('row: -1')
})
