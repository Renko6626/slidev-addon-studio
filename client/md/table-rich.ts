import type { TableData } from '../../shared/table'
import { normaliseTable } from '../../shared/table'
import { cellHTMLFromText, flattenCellHTML } from '../../shared/table-html'

/**
 * Switches a table between plain text and the inline-HTML cell subset.
 *
 * Enabling escapes every label and cell so nothing changes visually. Disabling
 * keeps the words and line breaks and drops the marks; one undo restores them.
 */
export function tableWithRich(table: TableData, rich: boolean): TableData {
  if (!!table.rich === rich)
    return table
  const data = normaliseTable(table)
  if (rich) {
    return normaliseTable({
      ...data,
      rich: true,
      columns: data.columns.map(column => ({ ...column, label: cellHTMLFromText(column.label) })),
      rows: data.rows.map(row => row.map(cell => cellHTMLFromText(cell))),
    })
  }
  return normaliseTable({
    ...data,
    rich: false,
    columns: data.columns.map(column => ({ ...column, label: flattenCellHTML(column.label) })),
    rows: data.rows.map(row => row.map(cell => flattenCellHTML(cell))),
  })
}