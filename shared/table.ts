/** Shared table shapes and pure row/column operations. */

export type TableAlign = 'left' | 'center' | 'right'

export interface TableColumn {
  label: string
  align?: TableAlign
  /** Share of the table width in percent; omitted means equal columns. */
  width?: number
}

/** A merged rectangle. `row` is -1 for the header row. */
export interface TableMerge {
  row: number
  column: number
  rowspan: number
  colspan: number
}

/** A rectangular cell selection, using -1 for the header row. */
export interface TableRect {
  rowStart: number
  rowEnd: number
  columnStart: number
  columnEnd: number
}

export interface TableData {
  columns: TableColumn[]
  rows: string[][]
  header: boolean
  border: boolean
  striped: boolean
  fontSize?: number
  /** Cells and labels hold the inline HTML subset; false/omitted is plain text. */
  rich?: boolean
  merges?: TableMerge[]
  /** Explicit header row height in CSS pixels. */
  headerHeight?: number
  /** Explicit body row heights; `null` means the row sizes to its content. */
  rowHeights?: (number | null)[]
}

/** One rendered position: a cell, its spans, or a position covered by a merge. */
export interface TableGridCell {
  row: number
  column: number
  rowspan: number
  colspan: number
  covered: boolean
}

export const TABLE_DEFAULTS = { header: true, border: true, striped: false } as const

export const DEFAULT_TABLE_SNIPPET = `<StudioTable :columns="[{ label: '列 1' }, { label: '列 2' }, { label: '列 3' }]" :rows="[['', '', ''], ['', '', '']]" />`

function positiveNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : undefined
}

function integer(value: unknown, minimum: number): number | undefined {
  return typeof value === 'number' && Number.isInteger(value) && value >= minimum ? value : undefined
}

function mergeOverlaps(a: TableMerge, b: TableMerge) {
  return a.row < b.row + b.rowspan && b.row < a.row + a.rowspan
    && a.column < b.column + b.colspan && b.column < a.column + a.colspan
}

/** Keeps only merges that are in bounds, larger than one cell, and disjoint. */
function normaliseMerges(raw: unknown, rows: number, columns: number): TableMerge[] {
  if (!Array.isArray(raw))
    return []
  const merges: TableMerge[] = []
  for (const entry of raw as TableMerge[]) {
    if (!entry || typeof entry !== 'object')
      continue
    const row = integer(entry.row, -1)
    const column = integer(entry.column, 0)
    if (row === undefined || column === undefined || column >= columns)
      continue
    const isHeader = row === -1
    const rowspan = isHeader ? 1 : integer(entry.rowspan ?? 1, 1)
    const colspan = integer(entry.colspan ?? 1, 1)
    if (rowspan === undefined || colspan === undefined)
      continue
    if (rowspan === 1 && colspan === 1)
      continue
    if (isHeader) {
      if (colspan > columns - column)
        continue
    }
    else if (row >= rows || row + rowspan > rows || column + colspan > columns) {
      continue
    }
    const merge: TableMerge = { row, column, rowspan, colspan }
    if (merges.some(other => mergeOverlaps(merge, other)))
      continue
    merges.push(merge)
  }
  return merges.sort((a, b) => a.row - b.row || a.column - b.column)
}

export function normaliseTable(table: TableData): TableData {
  const columns = table.columns.map(column => ({
    label: column.label ?? '',
    align: column.align === 'center' || column.align === 'right' ? column.align : 'left' as const,
    width: positiveNumber(column.width),
  }))
  const rows = table.rows.map(row => columns.map((_, index) => row[index] ?? ''))
  const merges = normaliseMerges(table.merges, rows.length, columns.length)
  const headerHeight = positiveNumber(table.headerHeight)
  const heights = Array.isArray(table.rowHeights)
    ? rows.map((_, index) => positiveNumber(table.rowHeights![index]) ?? null)
    : []
  const rowHeights = heights.some(height => height !== null) ? heights : undefined
  return {
    columns,
    rows,
    header: table.header,
    border: table.border,
    striped: table.striped,
    ...(positiveNumber(table.fontSize) !== undefined ? { fontSize: table.fontSize } : {}),
    ...(table.rich ? { rich: true } : {}),
    ...(merges.length ? { merges } : {}),
    ...(headerHeight !== undefined ? { headerHeight } : {}),
    ...(rowHeights ? { rowHeights } : {}),
  }
}

/** The cell layout the renderer, hit testing and Tab order all share. */
export function resolveTableGrid(table: TableData): TableGridCell[][] {
  const data = normaliseTable(table)
  const grid: TableGridCell[][] = data.rows.map((_, row) => data.columns.map((__, column) => ({
    row,
    column,
    rowspan: 1,
    colspan: 1,
    covered: false,
  })))
  if (data.header && data.columns.length) {
    grid.unshift(data.columns.map((_, column) => ({
      row: -1,
      column,
      rowspan: 1,
      colspan: 1,
      covered: false,
    })))
  }
  const offset = data.header && data.columns.length ? 1 : 0
  for (const merge of data.merges ?? []) {
    const anchor = grid[merge.row + offset]?.[merge.column]
    if (!anchor)
      continue
    anchor.rowspan = merge.rowspan
    anchor.colspan = merge.colspan
    for (let r = 0; r < merge.rowspan; r++) {
      for (let c = 0; c < merge.colspan; c++) {
        if (r === 0 && c === 0)
          continue
        const covered = grid[merge.row + offset + r]?.[merge.column + c]
        if (covered)
          covered.covered = true
      }
    }
  }
  return grid
}

/** The merge covering a position, if any. */
export function mergeAt(table: TableData, row: number, column: number): TableMerge | null {
  for (const merge of table.merges ?? []) {
    if (row >= merge.row && row < merge.row + merge.rowspan
      && column >= merge.column && column < merge.column + merge.colspan)
      return merge
  }
  return null
}

/** Maps any position inside a merged region to the cell that draws it. */
export function anchorOf(table: TableData, row: number, column: number): { row: number, column: number } {
  const merge = mergeAt(table, row, column)
  return merge ? { row: merge.row, column: merge.column } : { row, column }
}

export function mergeIntersectsRect(merge: TableMerge, rect: TableRect) {
  return merge.row < rect.rowEnd + 1 && rect.rowStart < merge.row + merge.rowspan
    && merge.column < rect.columnEnd + 1 && rect.columnStart < merge.column + merge.colspan
}

/** Merges a rectangle; returns the table unchanged when the range cannot merge. */
export function mergeTableRange(table: TableData, rect: TableRect): TableData {
  const data = normaliseTable(table)
  const { rowStart, rowEnd, columnStart, columnEnd } = rect
  if (![rowStart, rowEnd, columnStart, columnEnd].every(value => Number.isInteger(value)))
    return table
  const header = rowStart === -1 && rowEnd === -1
  if (rowStart === -1 || rowEnd === -1) {
    if (!header)
      return table
  }
  if (!header && (rowStart < 0 || rowEnd >= data.rows.length || rowStart > rowEnd))
    return table
  if (header && !data.header)
    return table
  if (columnStart < 0 || columnEnd >= data.columns.length || columnStart > columnEnd)
    return table
  const cellCount = (rowEnd - rowStart + 1) * (columnEnd - columnStart + 1)
  if (cellCount < 2)
    return table
  if ((data.merges ?? []).some(merge => mergeIntersectsRect(merge, rect)))
    return table

  const columns = header
    ? data.columns.map((column, index) => index > columnStart && index <= columnEnd ? { ...column, label: '' } : column)
    : data.columns
  const rows = header
    ? data.rows
    : data.rows.map((row, index) => index >= rowStart && index <= rowEnd
      ? row.map((cell, column) => column >= columnStart && column <= columnEnd
        && !(index === rowStart && column === columnStart) ? '' : cell)
      : row)
  const merges = [...(data.merges ?? []), {
    row: rowStart,
    column: columnStart,
    rowspan: rowEnd - rowStart + 1,
    colspan: columnEnd - columnStart + 1,
  }]
  return normaliseTable({ ...data, columns, rows, merges })
}

/** Removes the merge covering a position, leaving its covered cells empty. */
export function splitTableMerge(table: TableData, row: number, column: number): TableData {
  const data = normaliseTable(table)
  const merge = mergeAt(data, row, column)
  if (!merge)
    return table
  return normaliseTable({ ...data, merges: (data.merges ?? []).filter(other => other !== merge) })
}

export function withRowHeight(table: TableData, row: number | null, height: number | null): TableData {
  const data = normaliseTable(table)
  // `-1` is the header sentinel everywhere else (merges and rectangles).
  if (row === null || row === -1) {
    const { headerHeight: _, ...rest } = data
    return height && height > 0 ? { ...rest, headerHeight: Math.round(height) } : rest
  }
  if (row < 0 || row >= data.rows.length)
    return table
  const heights = data.rows.map((_, index) => data.rowHeights?.[index] ?? null)
  heights[row] = height && height > 0 ? Math.round(height) : null
  const { rowHeights: _, ...rest } = data
  return heights.some(value => value !== null) ? { ...rest, rowHeights: heights } : rest
}

function cloneMerges(merges: TableMerge[] | undefined): TableMerge[] {
  return (merges ?? []).map(merge => ({ ...merge }))
}

function adjustRowsForInsertion(merges: TableMerge[], at: number): TableMerge[] {
  for (const merge of merges) {
    if (merge.row < 0)
      continue
    if (at <= merge.row)
      merge.row += 1
    else if (at < merge.row + merge.rowspan)
      merge.rowspan += 1
  }
  return merges
}

function adjustRowsForRemoval(merges: TableMerge[], index: number): TableMerge[] {
  for (const merge of merges) {
    if (merge.row < 0)
      continue
    if (index < merge.row)
      merge.row -= 1
    else if (index < merge.row + merge.rowspan)
      merge.rowspan -= 1
  }
  return merges
}

function adjustColumnsForInsertion(merges: TableMerge[], at: number): TableMerge[] {
  for (const merge of merges) {
    if (at <= merge.column)
      merge.column += 1
    else if (at < merge.column + merge.colspan)
      merge.colspan += 1
  }
  return merges
}

function adjustColumnsForRemoval(merges: TableMerge[], index: number): TableMerge[] {
  for (const merge of merges) {
    if (index < merge.column)
      merge.column -= 1
    else if (index < merge.column + merge.colspan)
      merge.colspan -= 1
  }
  return merges
}

function heightList(table: TableData): (number | null)[] | undefined {
  return table.rowHeights ? table.rowHeights.slice() : undefined
}

export function addRow(table: TableData, at = table.rows.length): TableData {
  const data = normaliseTable(table)
  const index = Math.max(0, Math.min(at, data.rows.length))
  const rows = data.rows.slice()
  rows.splice(index, 0, data.columns.map(() => ''))
  const merges = adjustRowsForInsertion(cloneMerges(data.merges), index)
  const rowHeights = heightList(data)
  if (rowHeights)
    rowHeights.splice(index, 0, null)
  return normaliseTable({ ...data, rows, merges, rowHeights })
}

export function removeRow(table: TableData, index: number): TableData {
  const data = normaliseTable(table)
  if (index < 0 || index >= data.rows.length)
    return table
  const rows = data.rows.slice()
  rows.splice(index, 1)
  const merges = adjustRowsForRemoval(cloneMerges(data.merges), index)
  const rowHeights = heightList(data)
  if (rowHeights)
    rowHeights.splice(index, 1)
  return normaliseTable({ ...data, rows, merges, rowHeights })
}

function rowInsideMerge(table: TableData, row: number) {
  return (table.merges ?? []).some(merge => row >= merge.row && row < merge.row + merge.rowspan)
}

export function canMoveRow(table: TableData, index: number, direction: -1 | 1): boolean {
  const target = index + direction
  // Any merge touching either row would tear when the row moves.
  return Number.isInteger(index) && index >= 0 && index < table.rows.length && target >= 0 && target < table.rows.length
    && !rowInsideMerge(table, index) && !rowInsideMerge(table, target)
}

export function moveRow(table: TableData, index: number, direction: -1 | 1): TableData {
  const data = normaliseTable(table)
  if (!canMoveRow(data, index, direction))
    return table
  const target = index + direction
  const rows = data.rows.slice()
  const [row] = rows.splice(index, 1)
  rows.splice(target, 0, row!)
  const merges = adjustRowsForInsertion(adjustRowsForRemoval(cloneMerges(data.merges), index), target)
  const rowHeights = heightList(data)
  if (rowHeights) {
    const [height] = rowHeights.splice(index, 1)
    rowHeights.splice(target, 0, height ?? null)
  }
  return normaliseTable({ ...data, rows, merges, rowHeights })
}

export function addColumn(table: TableData, at = table.columns.length, column: TableColumn = { label: '' }): TableData {
  const data = normaliseTable(table)
  const index = Math.max(0, Math.min(at, data.columns.length))
  const columns = data.columns.slice()
  columns.splice(index, 0, { ...column })
  const rows = data.rows.map((row) => {
    const next = row.slice()
    next.splice(index, 0, '')
    return next
  })
  const merges = adjustColumnsForInsertion(cloneMerges(data.merges), index)
  return normaliseTable({ ...data, columns, rows, merges })
}

export function removeColumn(table: TableData, index: number): TableData {
  const data = normaliseTable(table)
  if (index < 0 || index >= data.columns.length)
    return table
  const columns = data.columns.filter((_, position) => position !== index)
  const rows = data.rows.map(row => row.filter((_, position) => position !== index))
  const merges = adjustColumnsForRemoval(cloneMerges(data.merges), index)
  return normaliseTable({ ...data, columns, rows, merges })
}

function columnInsideMerge(table: TableData, column: number) {
  return (table.merges ?? []).some(merge => column >= merge.column && column < merge.column + merge.colspan)
}

export function moveColumn(table: TableData, index: number, direction: -1 | 1): TableData {
  const data = normaliseTable(table)
  const target = index + direction
  if (index < 0 || index >= data.columns.length || target < 0 || target >= data.columns.length)
    return table
  if (columnInsideMerge(data, index) || columnInsideMerge(data, target))
    return table
  const columns = data.columns.slice()
  const [column] = columns.splice(index, 1)
  columns.splice(target, 0, column!)
  const rows = data.rows.map((row) => {
    const cells = row.slice()
    const [cell] = cells.splice(index, 1)
    cells.splice(target, 0, cell!)
    return cells
  })
  const merges = adjustColumnsForInsertion(adjustColumnsForRemoval(cloneMerges(data.merges), index), target)
  return normaliseTable({ ...data, columns, rows, merges })
}

/**
 * Moves one column boundary by a percentage of the table width.
 * Neighbours keep the total at 100% and stay above the minimum.
 */
export function resizeColumnWidths(widths: number[], boundary: number, deltaPercent: number, minPercent = 5): number[] {
  if (widths.length < 2 || boundary < 0 || boundary >= widths.length - 1)
    return widths
  const total = widths.reduce((sum, width) => sum + width, 0)
  if (!(total > 0))
    return widths
  const percent = widths.map(width => width / total * 100)
  if (!Number.isFinite(deltaPercent))
    return widths
  // A column already below the minimum may not shrink further; dragging that
  // way would otherwise jump it up to the minimum.
  const delta = deltaPercent < 0
    ? Math.min(0, Math.max(minPercent - percent[boundary], deltaPercent))
    : Math.max(0, Math.min(percent[boundary + 1] - minPercent, deltaPercent))
  if (delta === 0)
    return widths
  const next = percent.slice()
  next[boundary] += delta
  next[boundary + 1] -= delta
  return next
}

/** Returns the two columns beside a boundary to their automatic share. */
export function clearColumnWidths(columns: TableColumn[], boundary: number): TableColumn[] {
  if (boundary < 0 || boundary >= columns.length - 1)
    return columns
  return columns.map((column, index) => index === boundary || index === boundary + 1
    ? { ...column, width: undefined }
    : column)
}
