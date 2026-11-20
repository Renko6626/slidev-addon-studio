// @vitest-environment jsdom
import { expect, it } from 'vitest'
import { copyTableCells, decodeTableTSV, encodeTableTSV, pasteTableCells } from '../client/md/table-clipboard'
import { TABLE_DEFAULTS } from '../shared/table'

it('represents visible rich cells, covered positions and special characters as TSV', () => {
  const cells = copyTableCells({
    ...TABLE_DEFAULTS,
    rich: true,
    columns: [{ label: 'A' }, { label: 'B' }],
    rows: [['<strong>"A" &amp; B</strong><br>C\tD', 'hidden'], ['', '']],
    merges: [{ row: 0, column: 0, rowspan: 1, colspan: 2 }],
  }, { rowStart: 0, rowEnd: 1, columnStart: 0, columnEnd: 1 })
  expect(cells).toEqual([['"A" & B\nC\tD', ''], ['', '']])
  expect(decodeTableTSV(encodeTableTSV(cells))).toEqual(cells)
  expect(decodeTableTSV(encodeTableTSV([['one'], ['']]))).toEqual([['one'], ['']])
  expect(decodeTableTSV('a\tb\r\nc\r\n')).toEqual([['a', 'b'], ['c', '']])
})

it('stores pasted text in a rich table without turning clipboard text into markup', () => {
  const table = {
    ...TABLE_DEFAULTS,
    rich: true,
    columns: [{ label: '<strong>A</strong>' }, { label: 'B' }],
    rows: [['keep', '<em>Old</em>']],
  }
  const next = pasteTableCells(table, 0, 1, [['<em>Hi</em> & "there"\nnext']])
  expect(next?.rows).toEqual([['keep', '&lt;em&gt;Hi&lt;/em&gt; &amp; "there"<br>next']])
  expect(next?.columns).toEqual(table.columns)
  expect(table.rows).toEqual([['keep', '<em>Old</em>']])
})
