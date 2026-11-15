// @vitest-environment jsdom
import { resolve } from 'node:path'
import { afterEach, expect, it, vi } from 'vitest'
import { createApp, nextTick } from 'vue'
import type { App } from 'vue'
import * as i18n from '../client/i18n'
import * as inline from '../client/md/inline'
import * as format from '../client/md/format'
import * as html from '../client/md/html'
import * as lines from '../client/md/lines'
import * as elements from '../client/md/elements'
import * as interactions from '../client/md/interactions'
import * as text from '../client/text/source'
import * as state from '../client/state'
import * as projectSave from '../client/project-save'
import { onDomEvent } from '../client/composables/useDomEvent'
import { loadVueComponent } from './sfc'

const apps: App[] = []
afterEach(() => {
  apps.splice(0).forEach(app => app.unmount())
  state.editing.value = false
  state.selection.value = null
  document.body.replaceChildren()
  vi.restoreAllMocks()
})

async function setup(label = 'Old option') {
  const options = JSON.stringify([{ id: 'a', label, correct: true }]).replaceAll('"', '&quot;')
  let content = `<StudioQuestion question="q1" title="Question" :options="${options}" v-drag="[20,30,400,80]" />\n\n<StudioButton question="q1" action="choose" option="a" v-drag="[20,130,400,60]" />`
  let writes = 0
  const studio = { content: () => content, text: { stop: () => {} }, commit: async (next: string) => { writes++; content = next } }
  const Editor = loadVueComponent(resolve(process.cwd(), 'client/ui/InlineEditor.vue'), {
    '../i18n': i18n, '../md/inline': inline, '../md/format': format, '../md/html': html,
    '../md/lines': lines, '../md/elements': elements, '../md/interactions': interactions,
    '../text/source': text, '../state': state, '../project-save': projectSave,
    '../context': { useStudio: () => studio }, '../composables/useDomEvent': { onDomEvent },
    './parts/StudioIcon.vue': { default: { render: () => null } },
  })
  const target = document.createElement('button'), span = document.createElement('span')
  span.dataset.studioInteractionText = ''
  span.textContent = label
  target.append(span)
  document.body.append(target)
  const container = document.createElement('div'); document.body.append(container)
  const app = createApp(Editor); apps.push(app)
  const editor = app.mount(container) as unknown as { apply: () => Promise<void> }
  Object.defineProperty(document, 'execCommand', { configurable: true, value: () => true })
  state.selection.value = { el: target, no: 1, range: [2, 3], kind: 'component', tag: 'StudioButton', positioned: true, nested: false, label: 'Button' }
  state.editing.value = true
  await nextTick(); await nextTick()
  return { editor, span, container, content: () => content, writes: () => writes }
}

it('edits an option button visually and writes its question option without adding a button label', async () => {
  const s = await setup()
  expect(s.span.getAttribute('contenteditable')).toBe('true')
  expect(s.container.querySelector(`[title="${i18n.t('editMarkdown')}"]`)).toBeNull()
  s.span.textContent = 'Edited option'
  await s.editor.apply()
  const question = interactions.readInteraction(s.content(), [0, 1])
  expect(question?.kind === 'question' && question.options?.[0].label).toBe('Edited option')
  const button = interactions.readInteraction(s.content(), [2, 3])
  expect(button?.kind === 'button' && button.explicitLabel).toBe(false)
  expect(s.writes()).toBe(1)
  expect(s.span.hasAttribute('contenteditable')).toBe(false)
})

it('keeps source whitespace unchanged when plain text editing opens and closes without edits', async () => {
  const s = await setup('  Existing   option\nlabel  ')
  const before = s.content()
  expect(s.span.getAttribute('contenteditable')).toBe('true')
  await s.editor.apply()
  expect(s.content()).toBe(before)
  expect(s.writes()).toBe(0)
})
