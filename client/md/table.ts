import type { TableColumn, TableData, TableMerge } from '../../shared/table'
import type { SourceRange } from '../types'
import type { Attr } from './tags'
import { TABLE_DEFAULTS, normaliseTable } from '../../shared/table'
import { validateCellHTML } from '../../shared/table-html'
import { decodeEntities } from './entities'
import { formatStringMatrix, parseNullableNumberArray, parseObjectArray, parsePrimitive, parseStringLiteral, parseStringMatrix, quote, splitTopLevel } from './literals'
import { getBlock, replaceBlock } from './lines'
import { findAttr, opensWithTag, parseAttrs, sameAttr, writeAttr } from './tags'

export interface TableReadResult {
  table: TableData
  /** Whether the source carries an explicit columns or rows prop. */
  explicit: boolean
  /** The props exist but could not be read without rewriting them. */
  unparsed: boolean
}

const ALIGNMENTS = new Set(['left', 'center', 'right'])
const MERGE_KEYS = new Set(['row', 'column', 'rowspan', 'colspan'])

function defaults(): TableData {
  return { columns: [], rows: [], ...TABLE_DEFAULTS }
}

function decodeAttr(value: string) {
  const decoded = decodeEntities(value)
  if (!decoded.includes('&') || typeof document === 'undefined')
    return decoded
  // Use HTML attribute decoding for references outside Studio's own output.
  const template = document.createElement('template')
  template.innerHTML = `<span data-value="${value.replace(/"/g, '&quot;')}"></span>`
  return template.content.firstElementChild!.getAttribute('data-value')!
}

function readFlag(attr: Attr | undefined, fallback: boolean): boolean | undefined {
  if (!attr)
    return fallback
  // Bare and static attributes are truthy in the rendered table.
  if (!attr.bound)
    return true
  const value = decodeAttr(attr.value ?? '').trim()
  return value === 'true' ? true : value === 'false' ? false : undefined
}

function readNumber(block: string, name: string) {
  const value = findAttr(block, name)?.value
  if (!value)
    return undefined
  const number = Number(value)
  return Number.isFinite(number) && number > 0 ? number : undefined
}

export function parseTableColumns(raw: string | null | undefined): TableColumn[] | null {
  if (!raw)
    return null

  const text = raw.trim()
  if (!text.startsWith('[') || !text.endsWith(']'))
    return null

  const body = text.slice(1, -1).trim()
  if (!body)
    return []

  const columns: TableColumn[] = []
  for (const entry of splitTopLevel(body)) {
    if (!entry.startsWith('{') || !entry.endsWith('}'))
      return null

    const column: TableColumn = { label: '' }
    for (const pair of splitTopLevel(entry.slice(1, -1))) {
      const separator = pair.indexOf(':')
      if (separator === -1)
        return null
      const key = pair.slice(0, separator).trim().replace(/^['"`]|['"`]$/g, '')
      const raw = pair.slice(separator + 1).trim()
      if (key === 'label') {
        const value = parseStringLiteral(raw)
        if (value === undefined)
          return null
        column.label = value
      }
      else if (key === 'align') {
        const value = parseStringLiteral(raw)
        if (value === undefined || !ALIGNMENTS.has(value))
          return null
        column.align = value as TableColumn['align']
      }
      else if (key === 'width') {
        const value = parsePrimitive(raw)
        if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0)
          return null
        column.width = value
      }
      else {
        return null
      }
    }
    columns.push(column)
  }
  return columns
}

export function formatTableColumns(columns: TableColumn[], indent = '  '): string {
  if (!columns.length)
    return '[]'

  const rendered = columns.map((column) => {
    const parts = [`label: ${quote(column.label)}`]
    if (column.align && column.align !== 'left')
      parts.push(`align: ${quote(column.align)}`)
    if (column.width)
      parts.push(`width: ${column.width}`)
    return `{ ${parts.join(', ')} }`
  })
  const inline = `[${rendered.join(', ')}]`
  if (columns.length === 1 && inline.length <= 80)
    return inline
  return `[\n${rendered.map(column => `${indent}${column},`).join('\n')}\n]`
}

/** Reads the merge list strictly: bounds, direction and overlap all matter. */
export function parseTableMerges(raw: string | null | undefined, rows: number, columns: number): TableMerge[] | null {
  if (!raw)
    return null
  const entries = parseObjectArray(raw)
  if (!entries)
    return null

  const merges: TableMerge[] = []
  for (const entry of entries) {
    if (Object.keys(entry).some(key => !MERGE_KEYS.has(key)))
      return null
    const row = entry.row
    const column = entry.column
    const rowspan = entry.rowspan ?? 1
    const colspan = entry.colspan ?? 1
    if (typeof row !== 'number' || !Number.isInteger(row) || row < -1)
      return null
    if (typeof column !== 'number' || !Number.isInteger(column) || column < 0 || column >= columns)
      return null
    if (typeof rowspan !== 'number' || !Number.isInteger(rowspan) || rowspan < 1)
      return null
    if (typeof colspan !== 'number' || !Number.isInteger(colspan) || colspan < 1)
      return null
    if (rowspan === 1 && colspan === 1)
      return null
    if (row === -1) {
      if (rowspan !== 1 || column + colspan > columns)
        return null
    }
    else if (row >= rows || row + rowspan > rows || column + colspan > columns) {
      return null
    }
    const merge: TableMerge = { row, column, rowspan, colspan }
    if (merges.some(other => merge.row < other.row + other.rowspan && other.row < merge.row + merge.rowspan
      && merge.column < other.column + other.colspan && other.column < merge.column + merge.colspan))
      return null
    merges.push(merge)
  }
  return merges.sort((a, b) => a.row - b.row || a.column - b.column)
}

export function formatTableMerges(merges: TableMerge[], indent = '  '): string {
  if (!merges.length)
    return '[]'
  const rendered = merges.map((merge) => {
    const parts = [`row: ${merge.row}`, `column: ${merge.column}`]
    if (merge.rowspan > 1)
      parts.push(`rowspan: ${merge.rowspan}`)
    if (merge.colspan > 1)
      parts.push(`colspan: ${merge.colspan}`)
    return `{ ${parts.join(', ')} }`
  })
  const inline = `[${rendered.join(', ')}]`
  return inline.length <= 100 ? inline : `[\n${rendered.map(merge => `${indent}${merge},`).join('\n')}\n]`
}

function trimmedHeights(heights: (number | null)[] | undefined) {
  const values = heights?.slice() ?? []
  while (values.length && values[values.length - 1] === null)
    values.pop()
  return values
}

/** Reads the table data a StudioTable tag carries, without evaluating source. */
export function readTable(content: string, range: SourceRange): TableReadResult {
  const block = getBlock(content, range)
  const tag = opensWithTag(block)
  if (!tag || tag.name !== 'StudioTable')
    return { table: normaliseTable(defaults()), explicit: false, unparsed: false }

  const attrs = parseAttrs(tag.attrs)
  const headerAttrs = attrs.filter(attr => sameAttr(attr.name, 'header'))
  const header = readFlag(headerAttrs[0], true)
  const style = {
    header: header ?? TABLE_DEFAULTS.header,
    border: readFlag(attrs.find(attr => sameAttr(attr.name, 'border')), true) ?? TABLE_DEFAULTS.border,
    striped: readFlag(attrs.find(attr => sameAttr(attr.name, 'striped')), false) ?? TABLE_DEFAULTS.striped,
    fontSize: readNumber(block, 'fontSize'),
  }
  const columnAttrs = attrs.filter(attr => sameAttr(attr.name, 'columns'))
  const rowAttrs = attrs.filter(attr => sameAttr(attr.name, 'rows'))
  const mergeAttrs = attrs.filter(attr => sameAttr(attr.name, 'merges'))
  const heightAttrs = attrs.filter(attr => sameAttr(attr.name, 'rowHeights'))
  const headerHeightAttrs = attrs.filter(attr => sameAttr(attr.name, 'headerHeight'))
  const richAttrs = attrs.filter(attr => sameAttr(attr.name, 'rich'))
  const duplicated = [columnAttrs, rowAttrs, mergeAttrs, heightAttrs, headerHeightAttrs, richAttrs, headerAttrs].some(list => list.length > 1)
  if (attrs.some(attr => attr.name === 'v-bind' || (attr.bound && attr.name.startsWith('['))) || duplicated || header === undefined)
    return { table: normaliseTable({ ...defaults(), ...style }), explicit: true, unparsed: true }

  const columnsAttr = columnAttrs[0] ?? null
  const rowsAttr = rowAttrs[0] ?? null
  const mergeAttr = mergeAttrs[0] ?? null
  const heightAttr = heightAttrs[0] ?? null
  const headerHeightAttr = headerHeightAttrs[0] ?? null
  const richAttr = richAttrs[0] ?? null
  const explicit = !!columnsAttr || !!rowsAttr
  if (!explicit)
    return { table: normaliseTable({ ...defaults(), ...style }), explicit: false, unparsed: !!mergeAttr || !!heightAttr || !!headerHeightAttr || !!richAttr }

  let unparsed = false
  let columns: TableColumn[] | undefined
  let rows: string[][] | undefined

  if (columnsAttr) {
    if (!columnsAttr.bound || columnsAttr.value === null) {
      unparsed = true
    }
    else {
      const parsed = parseTableColumns(decodeAttr(columnsAttr.value))
      if (parsed)
        columns = parsed
      else
        unparsed = true
    }
  }

  if (rowsAttr) {
    if (!rowsAttr.bound || rowsAttr.value === null) {
      unparsed = true
    }
    else {
      const parsed = parseStringMatrix(decodeAttr(rowsAttr.value))
      if (parsed)
        rows = parsed
      else
        unparsed = true
    }
  }

  if (unparsed)
    return { table: normaliseTable({ ...defaults(), ...style }), explicit, unparsed: true }

  const tableRows = rows ?? []
  const tableColumns = columns?.length ? columns : Array.from({ length: tableRows.reduce((most, row) => Math.max(most, row.length), 0) }, () => ({ label: '' }))
  // A row wider than its columns cannot be represented without dropping cells.
  // Leave it to source editing rather than silently truncating it on the next write.
  if (tableRows.some(row => row.length > tableColumns.length))
    return { table: normaliseTable({ ...defaults(), ...style }), explicit, unparsed: true }

  let merges: TableMerge[] | undefined
  if (mergeAttr) {
    if (!mergeAttr.bound || mergeAttr.value === null) {
      unparsed = true
    }
    else {
      const parsed = parseTableMerges(decodeAttr(mergeAttr.value), tableRows.length, tableColumns.length)
      if (parsed)
        merges = parsed
      else
        unparsed = true
    }
  }

  let rowHeights: (number | null)[] | undefined
  if (heightAttr) {
    if (!heightAttr.bound || heightAttr.value === null) {
      unparsed = true
    }
    else {
      const parsed = parseNullableNumberArray(decodeAttr(heightAttr.value))
      if (!parsed || parsed.length > tableRows.length || parsed.some(value => value !== null && (!(value > 0) || !Number.isFinite(value))))
        unparsed = true
      else if (parsed.some(value => value !== null))
        rowHeights = parsed
    }
  }

  let headerHeight: number | undefined
  if (headerHeightAttr) {
    if (!headerHeightAttr.bound || headerHeightAttr.value === null) {
      unparsed = true
    }
    else {
      const value = Number(decodeAttr(headerHeightAttr.value))
      if (Number.isFinite(value) && value > 0)
        headerHeight = value
      else
        unparsed = true
    }
  }

  const rich = readFlag(richAttr ?? undefined, false)
  if (rich === undefined)
    unparsed = true
  // Unsupported cell markup keeps the source authoritative: the visual editor
  // cannot promise to preserve it on the next write.
  if (!unparsed && rich && typeof document !== 'undefined') {
    const cells = [...tableColumns.map(column => column.label), ...tableRows.flat()]
    if (cells.some(cell => !validateCellHTML(cell)))
      unparsed = true
  }

  if (unparsed)
    return { table: normaliseTable({ ...defaults(), ...style }), explicit, unparsed: true }

  return {
    table: normaliseTable({
      columns: tableColumns,
      rows: tableRows,
      ...style,
      rich,
      merges,
      headerHeight,
      rowHeights,
    }),
    explicit: true,
    unparsed: false,
  }
}

/** Writes only the data props; styling props stay exactly as the author wrote them. */
export function writeTable(content: string, range: SourceRange, table: TableData): string {
  const block = getBlock(content, range)
  const tag = opensWithTag(block)
  if (!tag || tag.name !== 'StudioTable')
    return content

  const data = normaliseTable(table)
  const indent = block.slice(block.lastIndexOf('\n', tag.start - 1) + 1, tag.start)
  let next = writeAttr(block, 'columns', attrValue(formatTableColumns(data.columns), indent), { bound: true })
  next = writeAttr(next, 'rows', attrValue(formatStringMatrix(data.rows), indent), { bound: true })
  next = writeAttr(next, 'rich', data.rich ? true : null)
  next = writeAttr(next, 'merges', data.merges?.length ? attrValue(formatTableMerges(data.merges), indent) : null, { bound: true })
  const heights = trimmedHeights(data.rowHeights)
  next = writeAttr(next, 'row-heights', heights.length ? attrValue(formatHeightList(heights)) : null, { bound: true })
  next = writeAttr(next, 'header-height', data.headerHeight ? String(data.headerHeight) : null, { bound: true })
  return replaceBlock(content, range, next)
}

function formatHeightList(heights: (number | null)[]) {
  return `[${heights.map(height => height === null ? 'null' : String(height)).join(', ')}]`
}

export interface TableStylePatch {
  header?: boolean
  border?: boolean
  striped?: boolean
  /** `null` removes an explicit size; omitting the key leaves it untouched. */
  fontSize?: number | null
}

/** Writes only the presentation props that actually changed. */
export function writeTableStyle(content: string, range: SourceRange, patch: TableStylePatch): string {
  const block = getBlock(content, range)
  const tag = opensWithTag(block)
  if (!tag || tag.name !== 'StudioTable')
    return content

  let next = block
  if ('header' in patch)
    next = writeAttr(next, 'header', patch.header ? true : 'false', { bound: !patch.header })
  if ('border' in patch)
    next = writeAttr(next, 'border', patch.border ? true : 'false', { bound: !patch.border })
  if ('striped' in patch)
    next = writeAttr(next, 'striped', patch.striped ? true : null)
  if ('fontSize' in patch) {
    next = patch.fontSize
      ? writeAttr(next, 'font-size', String(patch.fontSize), { bound: true })
      : writeAttr(next, 'font-size', null)
  }
  return replaceBlock(content, range, next)
}

function attrValue(value: string, indent = '') {
  // Newlines are structural here: one column or row per line. Only markup
  // characters are encoded, and continuation lines stay in the Markdown block.
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/\n/g, `\n${indent}`)
}

/** Markup inserted by the palette, the toolbar and the Markdown importer. */
export function tableSnippet(table: TableData): string {
  const data = normaliseTable(table)
  const props = [
    `  :columns="${attrValue(formatTableColumns(data.columns))}"`,
    `  :rows="${attrValue(formatStringMatrix(data.rows))}"`,
  ]
  if (!data.header)
    props.push('  :header="false"')
  if (!data.border)
    props.push('  :border="false"')
  if (data.striped)
    props.push('  striped')
  if (data.fontSize)
    props.push(`  :font-size="${data.fontSize}"`)
  if (data.rich)
    props.push('  rich')
  if (data.merges?.length)
    props.push(`  :merges="${attrValue(formatTableMerges(data.merges))}"`)
  const heights = trimmedHeights(data.rowHeights)
  if (heights.length)
    props.push(`  :row-heights="${formatHeightList(heights)}"`)
  if (data.headerHeight)
    props.push(`  :header-height="${data.headerHeight}"`)
  return `<StudioTable\n${props.join('\n')}\n/>`
}

export function tableFromMarkdownTable(columns: TableColumn[], rows: string[][]): TableData {
  return normaliseTable({ columns, rows, ...TABLE_DEFAULTS })
}
