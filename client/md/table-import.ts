import type { TableColumn } from '../../shared/table'

export interface MarkdownTableImport {
  columns: TableColumn[]
  rows: string[][]
  /** Whether inline Markdown was flattened into plain text. */
  flattened: boolean
}

const DELIMITER = /^:?-{3,}:?$/

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

  if (text.startsWith('|'))
    cells.shift()
  if (cells.length && text[text.length - 1] === '|' && !escaped(text, text.length - 1))
    cells.pop()
  return cells.map(cell => cell.trim())
}

function escaped(text: string, index: number) {
  let backslashes = 0
  for (let i = index - 1; i >= 0 && text[i] === '\\'; i--)
    backslashes += 1
  return backslashes % 2 === 1
}

/**
 * Reads a GFM table block. Header alignment comes from the delimiter row; body
 * rows are padded or truncated to the header width, as GFM renders them.
 */
export function parseMarkdownTable(block: string): MarkdownTableImport | null {
  const lines = block.split('\n').map(line => line.trim())
  if (lines.length < 2)
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
    if (!line || !line.includes('|'))
      break
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