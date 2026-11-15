// @vitest-environment jsdom
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { compileScript, parse } from 'vue/compiler-sfc'
import ts from 'typescript'
import * as Vue from 'vue'
import { afterEach, expect, it, vi } from 'vitest'
import { createApp, effectScope, h, nextTick, ref } from 'vue'
import type { App, Component, EffectScope } from 'vue'
import * as interactions from '../runtime/interactions'
import { useInteractionPage } from '../runtime/useInteractionPage'

const host = vi.hoisted(() => ({ context: null as any, nav: null as any }))
vi.mock('@slidev/client', () => ({ useSlideContext: () => host.context, useNav: () => host.nav }))

// Load the actual SFC with Vue's compiler; the repository test runner has no Vue plugin.
function component(name: string): Component {
  const file = resolve(process.cwd(), `components/${name}.vue`)
  const { descriptor } = parse(readFileSync(file, 'utf8'), { filename: file })
  const compiled = compileScript(descriptor, { id: name, inlineTemplate: true })
  const script = ts.transpileModule(compiled.content, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ESNext } }).outputText
  const exports: { default?: Component } = {}
  const modules: Record<string, unknown> = { vue: Vue, '../runtime/useInteractionPage': { useInteractionPage }, '../runtime/interactions': interactions }
  new Function('require', 'exports', script)((name: string) => {
    if (!(name in modules)) throw new Error(`Unexpected component import ${name}`)
    return modules[name]
  }, exports)
  return exports.default!
}
const Question = component('StudioQuestion'), Button = component('StudioButton'), Feedback = component('StudioFeedback')
const options = [{ id: 'a', label: 'Option A', correct: true }, { id: 'b', label: 'Option B', correct: false }]
const apps: App[] = [], scopes: EffectScope[] = []
afterEach(() => {
  apps.splice(0).forEach(app => app.unmount())
  scopes.splice(0).forEach(scope => scope.stop())
  interactions.setInteractionEditing(false)
  document.body.replaceChildren()
})
function setup() {
  host.context = { $page: ref(1), $renderContext: ref('slide') }
  host.nav = { currentSlideNo: ref(1), isPrintMode: ref(false), isNotesViewer: ref(false), isPresenter: ref(false) }
  const scope = effectScope(); scopes.push(scope)
  const page = scope.run(useInteractionPage)!
  function mount(render: () => unknown) {
    const container = document.createElement('div'); document.body.append(container)
    const app = createApp({ render }); apps.push(app); app.mount(container)
    return container
  }
  return { page, mount }
}

it('preserves answers when the real question rerenders with equal configuration arrays', async () => {
  const { page, mount } = setup()
  const current = ref({ question: 'q', mode: 'single', title: 'Question', options })
  mount(() => h(Question, current.value))
  interactions.dispatchInteraction({ question: 'q', action: 'choose', option: 'a' })
  current.value = { ...current.value, options: options.map(option => ({ ...option })) }
  await nextTick()
  expect(page.question('q')?.state).toEqual({ selected: ['a'], result: 'correct', attempts: 1 })
  current.value = { ...current.value, options: [{ ...options[0], correct: false }, options[1]] }
  await nextTick()
  expect(page.question('q')?.state).toEqual({ selected: [], result: null, attempts: 0 })
})

it('binds real button labels, dispatches once without a deck click, and limits appearance previews to editing', async () => {
  const { page, mount } = setup()
  mount(() => h(Question, { question: 'q', options, correctText: 'Yes', idleText: 'Choose' }))
  const container = mount(() => h(Button, { question: 'q', action: 'choose', option: 'a' }))
  const feedback = mount(() => h(Feedback, { question: 'q', effect: 'pop' }))
  const button = container.querySelector('button')!
  expect(button.textContent).toBe('Option A')
  const deckClick = vi.fn(), deckKey = vi.fn()
  container.addEventListener('click', deckClick); container.addEventListener('keydown', deckKey)
  button.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  await nextTick()
  expect(page.question('q')?.state.attempts).toBe(1)
  expect(deckClick).not.toHaveBeenCalled()
  expect(feedback.textContent).toBe('Yes')
  for (const key of ['Enter', ' ']) {
    const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true })
    button.dispatchEvent(event)
    expect(event.defaultPrevented).toBe(false)
  }
  expect(deckKey).not.toHaveBeenCalled()
  interactions.setInteractionEditing(true)
  button.dispatchEvent(new CustomEvent('studio-button-preview', { detail: 'incorrect' }))
  await nextTick()
  expect(button.dataset.quizAppearance).toBe('incorrect')
  button.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  expect(page.question('q')?.state.attempts).toBe(0)
  interactions.setInteractionEditing(false)
  await nextTick()
  expect(button.dataset.quizAppearance).toBe('normal')
})
