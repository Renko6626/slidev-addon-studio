import type { TableColumn, TableData } from '../../shared/table'
import type { SourceRange } from '../types'
import { TABLE_DEFAULTS, normaliseTable } from '../../shared/table'
import { decodeEntities } from './entities'
import { formatStringMatrix, parsePrimitive, parseStringMatrix, quote, splitTopLevel } from './literals'
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

function defaults(): TableData {
  return { columns: [], rows: [], ...TABLE_DEFAULTS }
}

function decodeAttr(value: string) {
  return decodeEntities(value)
}

function readFlag(block: string, name: string, fallback: boolean) {
  const attr = findAttr(block, name)
  if (!attr)
    return fallback
  if (attr.value === null)
    return true
  return attr.value !== 'false'
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
      const value = parsePrimitive(pair.slice(separator + 1).trim())
      if (value === undefined)
        return null
      if (key === 'label') {
        if (typeof value !== 'string')
          return null
        column.label = value
      }
      else if (key === 'align') {
        if (typeof value !== 'string' || !ALIGNMENTS.has(value))
          return null
        column.align = value as TableColumn['align']
      }
      else if (key === 'width') {
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

/** Reads the table data a StudioTable tag carries, without evaluating source. */
export function readTable(content: string, range: SourceRange): TableReadResult {
  const block = getBlock(content, range)
  const tag = opensWithTag(block)
  if (!tag || tag.name !== 'StudioTable')
    return { table: normaliseTable(defaults()), explicit: false, unparsed: false }

  const style = {
    header: readFlag(block, 'header', true),
    border: readFlag(block, 'border', true),
    striped: readFlag(block, 'striped', false),
    fontSize: readNumber(block, 'fontSize'),
  }
  const attrs = parseAttrs(tag.attrs)
  const columnAttrs = attrs.filter(attr => sameAttr(attr.name, 'columns'))
  const rowAttrs = attrs.filter(attr => sameAttr(attr.name, 'rows'))
  if (attrs.some(attr => attr.raw === 'v-bind') || columnAttrs.length > 1 || rowAttrs.length > 1)
    return { table: normaliseTable({ ...defaults(), ...style }), explicit: true, unparsed: true }

  const columnsAttr = columnAttrs[0] ?? null
  const rowsAttr = rowAttrs[0] ?? null
  const explicit = !!columnsAttr || !!rowsAttr
  if (!explicit)
    return { table: normaliseTable({ ...defaults(), ...style }), explicit: false, unparsed: false }

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
  const tableColumns = columns ?? Array.from({ length: tableRows.reduce((most, row) => Math.max(most, row.length), 0) }, () => ({ label: '' }))
  // A row wider than its columns cannot be represented without dropping cells.
  // Leave it to source editing rather than silently truncating it on the next write.
  if (tableRows.some(row => row.length > tableColumns.length))
    return { table: normaliseTable({ ...defaults(), ...style }), explicit, unparsed: true }

  return {
    table: normaliseTable({
      columns: tableColumns,
      rows: tableRows,
      ...style,
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
  let next = writeAttr(block, 'columns', attrValue(formatTableColumns(data.columns)), { bound: true })
  next = writeAttr(next, 'rows', attrValue(formatStringMatrix(data.rows)), { bound: true })
  return replaceBlock(content, range, next)
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

function attrValue(value: string) {
  // Newlines are structural here: one column or row per line. Only markup
  // characters are encoded; a literal newline in a cell is escaped by quote().
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
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
  return `<StudioTable\n${props.join('\n')}\n/>`
}

export function tableFromMarkdownTable(columns: TableColumn[], rows: string[][]): TableData {
  return normaliseTable({ columns, rows, ...TABLE_DEFAULTS })
}