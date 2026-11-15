// @vitest-environment jsdom
import { resolve } from 'node:path'
import { afterEach, expect, it, vi } from 'vitest'
import { createApp, effectScope, h, nextTick, ref } from 'vue'
import type { App, Component, EffectScope } from 'vue'
import * as interactions from '../runtime/interactions'
import { useInteractionPage } from '../runtime/useInteractionPage'
import { loadVueComponent } from './sfc'

const host = vi.hoisted(() => ({ context: null as any, nav: null as any }))
vi.mock('@slidev/client', () => ({ useSlideContext: () => host.context, useNav: () => host.nav }))

// Load the actual SFC with Vue's compiler; the repository test runner has no Vue plugin.
function component(name: string): Component {
  return loadVueComponent(resolve(process.cwd(), `components/${name}.vue`), {
    '../runtime/useInteractionPage': { useInteractionPage }, '../runtime/interactions': interactions,
  })
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

it('keeps hidden controls running, renders their bound prompt, and preserves answers when only visibility changes', async () => {
  const Title = component('StudioQuestionTitle')
  const { page, mount } = setup()
  const presentation = ref('hidden'), titleVisible = ref(true)
  const control = mount(() => h(Question, { question: 'q', name: 'Question 1', presentation: presentation.value, title: 'Which answer?', options }))
  const prompt = mount(() => titleVisible.value ? h(Title, { question: 'q' }) : null)
  const button = mount(() => h(Button, { question: 'q', action: 'choose', option: 'a' })).querySelector('button')!
  expect((control.firstElementChild as HTMLElement).style.display).toBe('none')
  expect(prompt.textContent).toBe('Which answer?')
  titleVisible.value = false
  await nextTick()
  button.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  await nextTick()
  expect(page.question('q')?.state.result).toBe('correct')
  presentation.value = 'summary'
  await nextTick()
  expect((control.firstElementChild as HTMLElement).style.display).not.toBe('none')
  expect(control.textContent).toContain('Question 1')
  expect(control.textContent).not.toContain('Which answer?')
  expect(page.question('q')?.state.attempts).toBe(1)
  interactions.setInteractionEditing(true)
  presentation.value = 'hidden'
  await nextTick()
  expect((control.firstElementChild as HTMLElement).style.display).not.toBe('none')
})

it('binds real button labels, dispatches once without a deck click, and limits appearance previews to editing', async () => {
  const { page, mount } = setup()
  mount(() => h(Question, { question: 'q', options, correctText: 'Yes', idleText: 'Choose' }))
  const container = mount(() => h(Button, { question: 'q', action: 'choose', option: 'a' }))
  const feedback = mount(() => h(Feedback, { question: 'q', effect: 'pop' }))
  const button = container.querySelector('button')!
  expect(button.textContent).toBe('Option A')
  expect(button.dataset.studioQuestionRef).toBe('q')
  expect((feedback.firstElementChild as HTMLElement).dataset.studioQuestionRef).toBe('q')
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
