import { parseSync } from '@slidev/parser'
import type { SlideInfo } from '@slidev/types'
import { expect, it } from 'vitest'
import { pageSourceInfo, pageSource, projectScripts } from '../client/source-context'

it('locates an imported page in its own file and retains its original Markdown and notes', () => {
  const markdown = '# Before\n\n---\nlayout: none\n---\n\n# Imported\n\n<GuestCard />\n\n<!-- speaker notes -->\n'
  const source = parseSync(markdown, '/project/pages/intro.md').slides[1]
  const slide = { source, content: source.content } as SlideInfo
  expect(pageSource(slide)).toEqual({ file: '/project/pages/intro.md', line: 3, markdown: source.raw })
  expect(pageSource(slide).markdown).toContain('<!-- speaker notes -->')
  const context = pageSourceInfo({
    no: 3, slide, project: { name: 'Deck', root: '/project', entry: 'slides.md', files: [] },
    component: { name: 'GuestCard', file: '/project/components/GuestCard.vue', source: 'project' },
    selectedSource: '<GuestCard />', error: 'GuestCard.vue:12: Unexpected token',
  })
  expect(context).toBe(`Slidev Studio 页面信息
工程目录：/project
入口文件：slides.md
当前页：第 3 页
当前页源码：/project/pages/intro.md:3
选中组件：GuestCard
组件定义：/project/components/GuestCard.vue
组件来源：project

最近错误：
GuestCard.vue:12: Unexpected token

选中对象的页面源码：
<GuestCard />

当前页原始 Markdown：
${source.raw}`)
})

it('lists project script paths without inferring page dependencies or guessing missing locations', () => {
  expect(projectScripts([
    { name: 'stores', path: 'stores', kind: 'directory', children: [{ name: 'game.ts', path: 'stores/game.ts', kind: 'file' }] },
    { name: 'notes.md', path: 'notes.md', kind: 'file' },
    { name: 'external.ts', path: 'external.ts', kind: 'link' },
  ])).toEqual(['stores/game.ts'])
  expect(pageSource(null)).toEqual({ file: '', line: null, markdown: '' })
})
