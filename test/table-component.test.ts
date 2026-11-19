// @vitest-environment jsdom
import { resolve } from 'node:path'
import { afterEach, expect, it } from 'vitest'
import { createApp, h } from 'vue'
import type { App, Component } from 'vue'
import * as tableApi from '../shared/table'
import { loadVueComponent } from './sfc'

const Table: Component = loadVueComponent(resolve(process.cwd(), 'components/StudioTable.vue'), {
  '../shared/table': tableApi,
})
const apps: App[] = []

afterEach(() => {
  apps.splice(0).forEach(app => app.unmount())
  document.body.replaceChildren()
})

function mount(props: Record<string, unknown>) {
  const root = document.createElement('div')
  document.body.append(root)
  const app = createApp({ render: () => h(Table, props) })
  apps.push(app)
  app.mount(root)
  return root
}

it('renders headers, cells, alignment and column widths', () => {
  const root = mount({
    columns: [{ label: '项目', width: 70 }, { label: '数值', align: 'right', width: 30 }],
    rows: [['电压', '3.3'], ['电流', '0.2']],
  })
  expect(root.querySelectorAll('th').length).toBe(2)
  expect(root.querySelector('th')!.textContent!.trim()).toBe('项目')
  expect(root.querySelector('th:nth-child(2)')!.getAttribute('style')).toContain('text-align: right')
  expect(root.querySelectorAll('td').length).toBe(4)
  expect(root.querySelector('col')!.getAttribute('style')).toContain('width: 70%')
  expect(root.querySelector('.studio-table')!.classList.contains('studio-table--border')).toBe(true)
})

it('omits the header row when header is false', () => {
  const root = mount({ columns: [{ label: 'A' }], rows: [['1']], header: false })
  expect(root.querySelector('thead')).toBeNull()
  expect(root.querySelector('td')!.textContent!.trim()).toBe('1')
})

it('pads ragged rows and derives columns from rows-only input', () => {
  const root = mount({ rows: [['a', 'b'], ['c']] })
  expect(root.querySelectorAll('th').length).toBe(2)
  expect(root.querySelectorAll('tbody tr')[1]!.querySelectorAll('td').length).toBe(2)
  expect(root.querySelectorAll('tbody tr')[1]!.querySelectorAll('td')[1]!.textContent!.trim()).toBe('')
})

it('renders authored markup as text and keeps empty cells', () => {
  const root = mount({ columns: [{ label: 'A' }, { label: 'B' }], rows: [['<b>x</b>', '']] })
  expect(root.querySelector('b')).toBeNull()
  expect(root.querySelector('td')!.textContent).toContain('<b>x</b>')
  expect(root.querySelectorAll('td')[1]!.textContent!.trim()).toBe('')
})

it('applies striped class and font size', () => {
  const root = mount({ columns: [{ label: 'A' }], rows: [['1']], striped: true, fontSize: 18, border: false })
  const table = root.querySelector('.studio-table')!
  expect(table.classList.contains('studio-table--striped')).toBe(true)
  expect(table.classList.contains('studio-table--border')).toBe(false)
  expect(table.getAttribute('style')).toContain('font-size: 18px')
})