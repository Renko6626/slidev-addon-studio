import { expect, it } from 'vitest'
import type { StudioContext } from '../client/context'
import type { StudioTarget } from '../client/types'
import { importMarkdownTable } from '../client/actions'
import { flattenInlineMarkdown, parseMarkdownTable } from '../client/md/table-import'
import { readTable } from '../client/md/table'
import { endOfBlock } from '../client/md/lines'

const markdown = `| 项目 | 数值 |
| :--- | ---: |
| **电压** | 3.3 |
| 电流 \\| 峰值 | 0.2 |`

it('reads alignment, escaped pipes and inline markdown', () => {
  const parsed = parseMarkdownTable(markdown)!
  expect(parsed.columns).toEqual([
    { label: '项目', align: 'left' },
    { label: '数值', align: 'right' },
  ])
  expect(parsed.rows).toEqual([['电压', '3.3'], ['电流 | 峰值', '0.2']])
  expect(parsed.flattened).toBe(true)
  expect(parseMarkdownTable('| A |\n| --- |\n| x \\| |')!.rows).toEqual([['x |']])
})

it('flattens links, images, code and line breaks', () => {
  expect(flattenInlineMarkdown('[文档](https://example.com) `x` ![alt](/a.png) <br> 第二行'))
    .toBe('文档 x alt\n 第二行')
  expect(flattenInlineMarkdown('a_b * c **d** < 5')).toBe('a_b * c d < 5')
})

it('pads missing cells and rejects malformed tables', () => {
  const parsed = parseMarkdownTable('| A | B |\n| --- | --- |\n| 1 |')!
  expect(parsed.rows).toEqual([['1', '']])
  expect(parseMarkdownTable('| A |\n| --- |\n| 1 | 2 | 3 |')!.rows).toEqual([['1']])
  expect(parseMarkdownTable('| A | B |\n| --- |')).toBeNull()
  expect(parseMarkdownTable('plain text')).toBeNull()
})

it('converts the selected Markdown table in one commit', async () => {
  let content = `${markdown}\n\nNeighbor`
  let writes = 0
  const studio = {
    content: () => content,
    no: () => 1,
    commit: async (next: string) => { content = next; writes++ },
    selectInserted: async () => true,
  } as unknown as StudioContext
  const target = { kind: 'table', range: [0, 4], nested: false, positioned: false, no: 1, el: {} as HTMLElement, label: 'Table' } as unknown as StudioTarget
  await importMarkdownTable(studio, target)
  expect(writes).toBe(1)
  expect(content).toContain('<StudioTable')
  expect(content).toContain('Neighbor')
  const lines = content.split('\n')
  const table = readTable(content, [0, endOfBlock(lines, 0)])
  expect(table.unparsed).toBe(false)
  expect(table.table.columns.map(column => column.label)).toEqual(['项目', '数值'])
  expect(table.table.rows).toEqual([['电压', '3.3'], ['电流 | 峰值', '0.2']])
})