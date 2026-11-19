// @vitest-environment jsdom
import { expect, it } from 'vitest'
import type { SourceRange } from '../client/types'
import type { TableData } from '../shared/table'
import { normaliseTable } from '../shared/table'
import { endOfBlock } from '../client/md/lines'
import { readTable, writeTable } from '../client/md/table'
import { tableWithRich } from '../client/md/table-rich'

function rangeOf(content: string): SourceRange {
  const lines = content.split('\n')
  const start = lines.findIndex(line => line.trim().startsWith('<StudioTable'))
  expect(start).toBeGreaterThanOrEqual(0)
  return [start, endOfBlock(lines, start)]
}

function plain(): TableData {
  return normaliseTable({
    columns: [{ label: '名 <称' }, { label: 'B' }],
    rows: [['a < b & c\n第二行', ''], ['4', '5']],
    header: true,
    border: true,
    striped: false,
  })
}

it('escapes plain cells when rich text is enabled', () => {
  const table = plain()
  const rich = tableWithRich(table, true)
  expect(rich.rich).toBe(true)
  expect(rich.columns[0].label).toBe('名 &lt;称')
  expect(rich.rows[0][0]).toBe('a &lt; b &amp; c<br>第二行')
  expect(tableWithRich(rich, true)).toBe(rich)
})

it('flattens rich cells and keeps line breaks when disabled', () => {
  const rich = tableWithRich(plain(), true)
  const flat = tableWithRich(rich, false)
  expect(flat.rich).toBeUndefined()
  expect(flat.columns[0].label).toBe('名 <称')
  expect(flat.rows[0][0]).toBe('a < b & c\n第二行')
})

it('reads, writes and validates the rich flag', () => {
  const content = `<StudioTable
  :columns="[{ label: 'A' }]"
  :rows="[['<strong>x</strong>']]"
  rich
/>`
  const read = readTable(content, rangeOf(content))
  expect(read.unparsed).toBe(false)
  expect(read.table.rich).toBe(true)
  const next = writeTable(content, rangeOf(content), read.table)
  expect(next).toContain(' rich')
  expect(readTable(next, rangeOf(next)).table.rich).toBe(true)
})

it('marks unsupported cell markup and dynamic flags as unparsed', () => {
  for (const content of [
    '<StudioTable :columns="[{ label: \'A\' }]" :rows="[[\'<span class="x">x</span>\']]" rich />',
    '<StudioTable :columns="[{ label: \'A\' }]" :rows="[[\'x\']]" :rich="flag" />',
  ])
    expect(readTable(content, [0, 1]).unparsed, content).toBe(true)
})
