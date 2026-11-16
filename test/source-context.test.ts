import { parseSync } from '@slidev/parser'
import type { SlideInfo } from '@slidev/types'
import { expect, it } from 'vitest'
import { agentSourceContext, pageSource, projectScripts } from '../client/source-context'

it('locates an imported page in its own file and retains its original Markdown and notes', () => {
  const markdown = '# Before\n\n---\nlayout: none\n---\n\n# Imported\n\n<GuestCard />\n\n<!-- speaker notes -->\n'
  const source = parseSync(markdown, '/project/pages/intro.md').slides[1]
  const slide = { source, content: source.content } as SlideInfo
  expect(pageSource(slide)).toEqual({ file: '/project/pages/intro.md', line: 3, markdown: source.raw })
  expect(pageSource(slide).markdown).toContain('<!-- speaker notes -->')
  const context = agentSourceContext({
    no: 3, slide, project: { name: 'Deck', root: '/project', entry: 'slides.md', files: [] },
    component: { name: 'GuestCard', file: '/project/components/GuestCard.vue', source: 'project' },
    selectedSource: '<GuestCard />', error: 'GuestCard.vue:12: Unexpected token',
  })
  expect(context).toContain('/project/pages/intro.md:3')
  expect(context).toContain('/project/components/GuestCard.vue')
  expect(context).toContain('GuestCard.vue:12: Unexpected token')
  expect(context).toContain('skills/studio-authoring/SKILL.md')
  expect(context).toContain('v-drag')
  expect(context).toContain(source.raw)
})

it('lists project script paths without inferring page dependencies or guessing missing locations', () => {
  expect(projectScripts([
    { name: 'stores', path: 'stores', kind: 'directory', children: [{ name: 'game.ts', path: 'stores/game.ts', kind: 'file' }] },
    { name: 'notes.md', path: 'notes.md', kind: 'file' },
    { name: 'external.ts', path: 'external.ts', kind: 'link' },
  ])).toEqual(['stores/game.ts'])
  expect(pageSource(null)).toEqual({ file: '', line: null, markdown: '' })
})
