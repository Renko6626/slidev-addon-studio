// @vitest-environment jsdom
import { resolve } from 'node:path'
import { afterEach, expect, it, vi } from 'vitest'
import { createApp, effectScope, nextTick } from 'vue'
import type { App } from 'vue'
import * as i18n from '../client/i18n'
import * as lines from '../client/md/lines'
import * as interactions from '../client/md/interactions'
import * as text from '../client/text/source'
import * as state from '../client/state'
import type { CatalogComponent } from '../client/types'
import * as componentFields from '../client/component-fields'
import * as fieldSource from '../client/md/component-fields'
import * as sourceLabel from '../client/source-label'
import { editSource } from '../client/actions'
import { useTextEditor } from '../client/composables/useTextEditor'
import { onDomEvent } from '../client/composables/useDomEvent'
import { loadVueComponent } from './sfc'

const apps: App[] = []
let catalog: CatalogComponent[] = []
const scopes: ReturnType<typeof effectScope>[] = []
afterEach(() => {
  apps.splice(0).forEach(app => app.unmount())
  scopes.splice(0).forEach(scope => scope.stop())
  catalog = []
  state.editComponentField.value = null
  state.editSourceRequested.value = false
  state.editing.value = false
  state.selection.value = null
  document.body.replaceChildren()
  vi.restoreAllMocks()
})

function loadEditor(studio: any) {
  return loadVueComponent(resolve(process.cwd(), 'client/ui/InlineEditor.vue'), {
    '../i18n': i18n, '../component-fields': componentFields, '../md/component-fields': fieldSource,
    '../composables/useCatalog': { useCatalog: () => ({ components: catalog }) },
    '../md/lines': lines, '../md/interactions': interactions,
    '../text/source': text, '../source-label': sourceLabel, '../state': state,
    '../context': { useStudio: () => studio }, '../composables/useDomEvent': { onDomEvent },
    './parts/StudioIcon.vue': { default: { render: () => null } },
  })
}

it('edits standard button content directly through its declared rich-text field', async () => {
  const metadata: CatalogComponent = { name: 'StudioButton', file: '', source: 'addon', origin: 'Studio', snippet: '', preview: '', previewable: false, propsMode: 'declared', props: [{ name: 'contentHtml', control: 'richtext' }] }
  const source = '<StudioButton question="q1" action="choose" option="A" content-html="&lt;p&gt;Old option&lt;/p&gt;" v-drag="[20,130,400,60]" />'
  const s = await sourceSession(source, '<div data-studio-component="StudioButton"><div data-studio-field="contentHtml"><p>Old option</p></div></div>', 'html', false, metadata)
  s.studio.text.editor.value!.commands.setContent('<p>Edited <strong>option</strong></p>')
  await s.editor.apply()
  const saved = fieldSource.readComponentString(s.content(), [0, 1], metadata.props[0])
  expect(saved.editable).toBe(true)
  const rendered = document.createElement('div')
  rendered.innerHTML = saved.editable ? saved.value : ''
  expect(rendered.textContent).toBe('Edited option')
  expect(rendered.querySelector('strong')?.textContent).toBe('option')
  expect(interactions.readInteraction(s.content(), [0, 1])).toMatchObject({ kind: 'button', question: 'q1', option: 'A' })
  expect(s.writes()).toBe(1)
})

it('keeps local feedback source whitespace unchanged on an untouched plain field session', async () => {
  const metadata: CatalogComponent = { name: 'StudioFeedback', file: '', source: 'addon', origin: 'Studio', snippet: '', preview: '', previewable: false, propsMode: 'declared', props: [{ name: 'idleText', control: 'text' }] }
  const source = '<StudioFeedback question="q1" idle-text="  Existing   feedback  " />'
  const s = await sourceSession(source, '<div data-studio-component="StudioFeedback"><span data-studio-field="idleText">  Existing   feedback  </span></div>', 'html', false, metadata)
  expect(s.el.querySelector('[data-studio-field]')?.getAttribute('contenteditable')).toBe('true')
  await s.editor.apply()
  expect(s.content()).toBe(source + '\n\nNeighbor')
  expect(s.writes()).toBe(0)
  state.editing.value = true
  await nextTick(); await nextTick()
  s.el.querySelector('[data-studio-field]')!.textContent = 'Choose again'
  await s.editor.apply()
  expect(fieldSource.readComponentString(s.content(), [0, 1], metadata.props[0])).toMatchObject({ value: 'Choose again' })
  expect(s.content()).toContain('question="q1"')
  expect(s.writes()).toBe(1)
})

async function sourceSession(block: string, rendered: string, kind: 'html' | 'quote' = 'html', forceSource = false, component?: CatalogComponent) {
  let content = `${block}\n\nNeighbor`
  let writes = 0
  const target = document.createElement('div')
  target.innerHTML = rendered
  document.body.append(target)
  const el = target.firstElementChild as HTMLElement
  const studio = {
    content: () => content, no: () => 1,
    commit: async (next: string) => { content = next; writes++ },
    selectInserted: async () => true,
    text: null as unknown as ReturnType<typeof useTextEditor>,
  }
  const scope = effectScope(); scopes.push(scope)
  studio.text = scope.run(() => useTextEditor(studio))!
  const container = document.createElement('div')
  document.body.append(container)
  if (component) catalog = [component]
  const app = createApp(loadEditor(studio)); apps.push(app)
  const editor = app.mount(container) as unknown as { apply: () => Promise<void> }
  if (component) catalog = [component]
  state.selection.value = { el, no: 1, range: [0, block.split('\n').length], kind: component ? 'component' : kind, tag: component?.name ?? (kind === 'html' ? el.tagName.toLowerCase() : undefined), positioned: false, nested: false, label: 'Text' }
  if (forceSource) editSource()
  else state.editing.value = true
  await nextTick(); await nextTick()
  return { editor, container, el, studio, content: () => content, writes: () => writes }
}

it('opens complex HTML as authored source and applies only the selected range', async () => {
  const source = '<div class="note"><span :style="customStyle">Old</span></div>'
  const s = await sourceSession(source, '<div class="note"><span style="color:red">Old</span></div>')
  const area = s.container.querySelector('textarea')!
  expect(area?.value).toBe(source)
  area.value = source.replace('Old', 'New')
  area.dispatchEvent(new Event('input', { bubbles: true }))
  await s.editor.apply()
  expect(s.content()).toBe(source.replace('Old', 'New') + '\n\nNeighbor')
  expect(s.writes()).toBe(1)
})

it('keeps unsupported Vue bindings intact when opening and applying without edits', async () => {
  const source = '<h1><span :style="customStyle">Hello</span></h1>'
  const s = await sourceSession(source, '<h1><span style="color:red">Hello</span></h1>')
  expect(s.container.querySelector('textarea')?.value).toBe(source)
  await s.editor.apply()
  expect(s.content()).toBe(source + '\n\nNeighbor')
  expect(s.writes()).toBe(0)
})

it('cancels source edits without writing or changing the rendered object', async () => {
  const source = '<div class="note">Original</div>'
  const s = await sourceSession(source, source)
  const area = s.container.querySelector('textarea')!
  expect(area).not.toBeNull()
  area.value = '<div>Discard</div>'
  area.dispatchEvent(new Event('input', { bubbles: true }))
  s.container.querySelector<HTMLButtonElement>(`[title="${i18n.t('cancelEdit')}"]`)!.click()
  await nextTick()
  expect(s.content()).toBe(source + '\n\nNeighbor')
  expect(s.el.outerHTML).toBe(source)
  expect(s.writes()).toBe(0)
})

it('carries a rich-text draft and its held range into source editing', async () => {
  const source = '<p>Original</p>'
  const s = await sourceSession(source, source)
  s.studio.text.editor.value!.commands.setContent('<p>Changed</p><p>Added paragraph</p>')
  s.container.querySelector<HTMLButtonElement>('[data-studio-edit-source]')!.click()
  await nextTick()
  expect(s.container.querySelector('textarea')?.value).toContain('Changed')
  expect(s.el.outerHTML).toBe(source)
  await s.editor.apply()
  expect(s.content()).toContain('Changed')
  expect(s.content()).toContain('Added paragraph')
  expect(s.content().split('Neighbor')).toHaveLength(2)
  expect(s.writes()).toBe(1)
})


it('explicit source command bypasses rich text for a supported paragraph', async () => {
  const source = '<p class="lead">Original</p>'
  const s = await sourceSession(source, source, 'html', true)
  expect(s.container.querySelector('textarea')?.value).toBe(source)
  expect(s.studio.text.editor.value).toBeNull()
  expect(s.el.outerHTML).toBe(source)
})

it('edits a quote as source without taking ownership of its neighboring block', async () => {
  const s = await sourceSession('> Original', '<blockquote><p>Original</p></blockquote>', 'quote')
  const area = s.container.querySelector('textarea')!
  expect(area.value).toBe('> Original')
  area.value = '> Changed'
  area.dispatchEvent(new Event('input', { bubbles: true }))
  await s.editor.apply()
  expect(s.content()).toBe('> Changed\n\nNeighbor')
})


const card: CatalogComponent = { name: 'Card', file: 'Card.vue', source: 'project', origin: 'Project', snippet: '', preview: '', previewable: false, propsMode: 'declared', props: [{ name: 'contentHtml', control: 'richtext', type: 'string' }, { name: 'imageSrc', control: 'image', type: 'string' }] }
const cardSource = '<Card content-html="&lt;p&gt;Original&lt;/p&gt;" image-src="/photo.svg" v-drag="[1,2,300,100]" />'
const cardDOM = '<div data-studio-component="Card"><div data-studio-field="contentHtml"><p>Original</p></div><img data-studio-field="imageSrc" src="/photo.svg"></div>'

it.each(['rich', 'source'])('edits a component field through %s while keeping selection and geometry on its owner', async mode => {
  const s = await sourceSession(cardSource, cardDOM, 'html', false, card)
  expect(state.selection.value?.el).toBe(s.el)
  expect(s.studio.text.editor.value).not.toBeNull()
  s.studio.text.editor.value!.commands.setContent('<p>Changed</p><p>Second</p>')
  if (mode === 'source') {
    s.container.querySelector<HTMLButtonElement>('[data-studio-edit-source]')!.click()
    await nextTick()
    expect(s.container.querySelector('textarea')?.value).toContain('Second')
  }
  await s.editor.apply()
  const value = fieldSource.readComponentString(s.content(), [0, 1], card.props[0])
  expect(value.editable && value.value).toContain('Changed')
  expect(value.editable && value.value).toContain('Second')
  expect(s.content()).toContain('image-src="/photo.svg" v-drag="[1,2,300,100]"')
  expect(s.el.outerHTML).toBe(cardDOM)
  expect(s.writes()).toBe(1)
})

it('keeps component source unchanged when a field edit is cancelled', async () => {
  const s = await sourceSession(cardSource, cardDOM, 'html', false, card)
  s.studio.text.editor.value!.commands.setContent('<p>Discard</p>')
  s.container.querySelector<HTMLButtonElement>(`[title="${i18n.t('cancelEdit')}"]`)!.click()
  await nextTick()
  expect(s.content()).toBe(cardSource + '\n\nNeighbor')
  expect(s.el.outerHTML).toBe(cardDOM)
  expect(s.writes()).toBe(0)
})

it('keeps nested component fields outside the parent field lookup', () => {
  const root = document.createElement('div')
  root.innerHTML = '<div data-studio-component="Card"><div data-studio-component="Child"><div data-studio-field="contentHtml">Child</div></div></div>'
  const el = root.firstElementChild as HTMLElement
  const owner = { el, tag: 'Card', range: [0, 1] } as unknown as import('../client/types').StudioTarget
  expect(componentFields.resolveComponentField(owner, el.querySelector('[data-studio-field]'), card)).toBeNull()
  expect(componentFields.componentFieldElement(owner, 'contentHtml')).toBeNull()
})
