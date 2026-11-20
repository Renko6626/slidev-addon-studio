import type { TableColumn } from '../../shared/table'

export interface MarkdownTableImport {
  columns: TableColumn[]
  rows: string[][]
  /** Whether inline Markdown was flattened into plain text. */
  flattened: boolean
}

const DELIMITER = /^:?-+:?$/

/** Removes inline Markdown so a cell keeps its content, not its syntax. */
export function flattenInlineMarkdown(text: string): string {
  return text
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/`([^`]*)`/g, '$1')
    .replace(/(\*\*|__)(.+?)\1/g, '$2')
    .replace(/~~(.*?)~~/g, '$1')
    .replace(/<\/?(?:b|i|em|strong|code|span|sup|sub|u|s|small|mark)\b[^>]*>/gi, '')
    .replace(/\\([\\`*_{}[\]()#+\-.!|>])/g, '$1')
    .replace(/[ \t]+\n/g, '\n')
    .trim()
}

function splitRow(line: string): string[] {
  const text = line.trim()
  const cells: string[] = []
  let current = ''
  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    if (char === '\\' && text[i + 1] === '|') {
      current += '|'
      i += 1
      continue
    }
    if (char === '|') {
      cells.push(current)
      current = ''
      continue
    }
    current += char
  }
  cells.push(current)

  if (cells[0] === '')
    cells.shift()
  if (cells.at(-1) === '')
    cells.pop()
  return cells.map(cell => cell.trim())
}

/**
 * Reads the source range of a rendered Markdown table. Header alignment comes
 * from the delimiter row; body rows are padded or truncated to the header width.
 */
export function parseMarkdownTable(block: string): MarkdownTableImport | null {
  const lines = block.trimEnd().split('\n').map(line => line.trim())
  if (lines.length < 2 || !lines[0].includes('|'))
    return null
  // The first line can also open a list item or blockquote. A component cannot
  // replace that line without changing its surrounding Markdown.
  if (/^(?:>|(?:[-+*]|\d{1,9}[.)])\s)/.test(lines[0]))
    return null

  const header = splitRow(lines[0])
  const delimiter = splitRow(lines[1])
  if (!header.length || header.length !== delimiter.length)
    return null
  if (!delimiter.every(cell => DELIMITER.test(cell)))
    return null

  let flattened = false
  const columns: TableColumn[] = header.map((cell, index) => {
    const label = flattenInlineMarkdown(cell)
    if (label !== cell)
      flattened = true
    const marker = delimiter[index]
    const align = marker.startsWith(':') && marker.endsWith(':') ? 'center'
      : marker.endsWith(':') ? 'right'
        : 'left'
    return { label, align }
  })

  const rows: string[][] = []
  for (const line of lines.slice(2)) {
    if (!line)
      return null
    const cells = splitRow(line)
    const row = columns.map((_, index) => {
      const raw = cells[index] ?? ''
      const text = flattenInlineMarkdown(raw)
      if (text !== raw)
        flattened = true
      return text
    })
    if (cells.some((cell, index) => index >= columns.length && cell))
      flattened = true
    rows.push(row)
  }

  return { columns, rows, flattened }
}
