// @vitest-environment jsdom
import { resolve } from 'node:path'
import { afterEach, expect, it, vi } from 'vitest'
import { createApp, defineComponent, h, inject, nextTick, onScopeDispose, provide, ref, shallowReactive } from 'vue'
import type { App, Component } from 'vue'
import * as interactions from '../runtime/interactions'
import { useInteractionPage } from '../runtime/composables/useInteractionPage'
import * as runtimeApi from '../runtime'
import * as previewRuntime from '../runtime/preview'
import { quizStore } from '../runtime/stores/quiz'
import type { StudioRuntime } from '../runtime'
import { initializeRuntime, installStudioRuntime, setRuntimeEditing } from '../runtime/app'
import { injectionCurrentPage, injectionRenderContext } from '@slidev/client/constants'
import { loadVueComponent } from './sfc'

const host = vi.hoisted(() => ({ nav: null as any, readSlide: vi.fn() }))
vi.mock('@slidev/client', () => ({ useSlideContext: () => host.readSlide(), useNav: () => host.nav }))

// Load the actual SFC with Vue's compiler; the repository test runner has no Vue plugin.
function component(name: string): Component {
  return loadVueComponent(resolve(process.cwd(), `components/${name}.vue`), {
    '../runtime/composables/useInteractionPage': { useInteractionPage }, '../runtime': runtimeApi,
  })
}
const Question = component('StudioQuestion'), Button = component('StudioButton'), Feedback = component('StudioFeedback')
const options = [{ id: 'a', label: 'Option A', correct: true }, { id: 'b', label: 'Option B', correct: false }]
const apps: App[] = []
afterEach(() => {
  apps.splice(0).forEach(app => app.unmount())
  document.body.replaceChildren()
})
function setup() {
  const pageRef = ref(1)
  host.readSlide.mockReset().mockImplementation(() => {
    const $page = inject(injectionCurrentPage), $renderContext = inject(injectionRenderContext)
    if (!$page || !$renderContext) throw new Error('Missing SlideWrapper')
    return { $page, $renderContext }
  })
  host.nav = { currentSlideNo: ref(1), currentSlideRoute: ref({ no: 1 }), hasPrimarySlide: ref(true), isEmbedded: ref(false), isPrintMode: ref(false), isNotesViewer: ref(false), isPresenter: ref(false) }
  const children = shallowReactive<(() => unknown)[]>([])
  let page!: ReturnType<typeof useInteractionPage>
  const Probe = defineComponent({ setup() { page = useInteractionPage(); return () => null } })
  const app = createApp({ setup() {
    provide(injectionCurrentPage, pageRef)
    provide(injectionRenderContext, ref('slide'))
    return () => [h(Probe), ...children.map((render, index) => h('div', { 'data-mount': index }, [render() as any]))]
  } })
  const runtime = installStudioRuntime(app)
  initializeRuntime(runtime, { editing: false, canRunServices: true })
  const root = document.createElement('div'); document.body.append(root)
  apps.push(app); app.mount(root)
  async function mount(render: () => unknown) {
    const index = children.push(render) - 1
    await nextTick()
    return root.querySelector(`[data-mount="${index}"]`) as HTMLElement
  }
  return { page, runtime, mount }
}

it('preserves answers when the real question rerenders with equal configuration arrays', async () => {
  const { page, runtime, mount } = setup()
  const current = ref({ question: 'q', mode: 'single', title: 'Question', options })
  await mount(() => h(Question, current.value))
  interactions.dispatchInteraction(runtime, { question: 'q', action: 'choose', option: 'a' })
  current.value = { ...current.value, options: options.map(option => ({ ...option })) }
  await nextTick()
  expect(page.question('q')?.state).toEqual({ selected: ['a'], result: 'correct', attempts: 1 })
  current.value = { ...current.value, options: [{ ...options[0], correct: false }, options[1]] }
  await nextTick()
  expect(page.question('q')?.state).toEqual({ selected: [], result: null, attempts: 0 })
})

it('keeps hidden controls running, renders their bound prompt, and preserves answers when only visibility changes', async () => {
  const Title = component('StudioQuestionTitle')
  const { page, runtime, mount } = setup()
  const presentation = ref('hidden'), titleVisible = ref(true)
  const control = await mount(() => h(Question, { question: 'q', name: 'Question 1', presentation: presentation.value, title: 'Which answer?', options }))
  const prompt = await mount(() => titleVisible.value ? h(Title, { question: 'q' }) : null)
  const button = (await mount(() => h(Button, { question: 'q', action: 'choose', option: 'a' }))).querySelector('button')!
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
  setRuntimeEditing(runtime, true)
  presentation.value = 'hidden'
  await nextTick()
  expect((control.firstElementChild as HTMLElement).style.display).not.toBe('none')
})

it('binds real button labels, dispatches once without a deck click, and limits appearance previews to editing', async () => {
  const { page, runtime, mount } = setup()
  await mount(() => h(Question, { question: 'q', options, correctText: 'Yes', idleText: 'Choose' }))
  const container = await mount(() => h(Button, { question: 'q', action: 'choose', option: 'a' }))
  const feedback = await mount(() => h(Feedback, { question: 'q', effect: 'pop' }))
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
  setRuntimeEditing(runtime, true)
  button.dispatchEvent(new CustomEvent('studio-button-preview', { detail: 'incorrect' }))
  await nextTick()
  expect(button.dataset.quizAppearance).toBe('incorrect')
  button.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  expect(page.question('q')?.state.attempts).toBe(0)
  setRuntimeEditing(runtime, false)
  await nextTick()
  expect(button.dataset.quizAppearance).toBe('normal')
})

it('updates two count views including a global layer, renders props on the positioning root, and resets the shared count', async () => {
  const Count = component('StudioCorrectCount')
  const { runtime, mount } = setup()
  let globalQuiz!: ReturnType<typeof runtimeApi.useQuiz>
  const GlobalReader = defineComponent({ setup() {
    globalQuiz = runtimeApi.useQuiz()
    return () => h(Count, { label: 'Solved', fontSize: 30, color: '#123456', style: { width: '300px' } })
  } })
  const Global = defineComponent({ setup() {
    provide(injectionRenderContext, ref('none'))
    return () => h(GlobalReader)
  } })
  await mount(() => h(Question, { question: 'q', options }))
  const local = await mount(() => h(Count))
  const global = await mount(() => h(Global))
  expect(local.textContent).toBe('已答对 0')
  expect(global.textContent).toBe('Solved 0')
  expect(global.children).toHaveLength(1)
  const root = global.firstElementChild as HTMLElement
  expect(root.style.fontSize).toBe('30px')
  expect(root.style.color).toBe('rgb(18, 52, 86)')
  expect(root.style.width).toBe('300px')
  expect(globalQuiz.question('q').value).toBeUndefined()
  expect(globalQuiz.dispatch({ question: 'q', action: 'choose', option: 'a' })).toBe(false)
  expect(interactions.dispatchInteraction(runtime, { question: 'q', action: 'choose', option: 'a' })).toBe(true)
  await nextTick()
  expect([local.textContent, global.textContent]).toEqual(['已答对 1', 'Solved 1'])
  runtime.resetTrial()
  await nextTick()
  expect([local.textContent, global.textContent]).toEqual(['已答对 0', 'Solved 0'])
})

it('shares question bindings inside each preview and keeps preview counts and actions independent of the main trial', async () => {
  const Count = component('StudioCorrectCount'), Title = component('StudioQuestionTitle')
  const { runtime, mount } = setup()
  await mount(() => h(Question, { question: 'q', options }))
  const mainCount = await mount(() => h(Count))
  interactions.dispatchInteraction(runtime, { question: 'q', action: 'choose', option: 'a' })
  const previews: StudioRuntime[] = []
  const Preview = defineComponent({ setup() {
    const runtime = previewRuntime.createPreviewRuntime()
    previews.push(runtime)
    previewRuntime.providePreviewRuntime(runtime)
    onScopeDispose(() => previewRuntime.disposePreviewRuntime(runtime))
    return () => [h(Question, { question: 'q', title: 'Preview question', options }), h(Title, { question: 'q' }), h(Button, { question: 'q', action: 'choose', option: 'a' }), h(Count)]
  } })
  const reads = host.readSlide.mock.calls.length
  const first = await mount(() => h(Preview))
  const second = await mount(() => h(Preview))
  expect(host.readSlide.mock.calls.length).toBe(reads)
  expect(first.querySelector('.studio-question-title')?.textContent).toBe('Preview question')
  expect(first.querySelector('button')?.textContent).toBe('Option A')
  expect(first.querySelector('.studio-correct-count')?.textContent).toBe('已答对 0')
  first.querySelector('button')!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  expect(quizStore(previews[0]).correctCount).toBe(0)
  expect(interactions.dispatchInteraction(previews[0], { question: 'q', action: 'choose', option: 'a' })).toBe(false)
  // A preview's store remains isolated even when a custom component writes its own trial state.
  quizStore(previews[0]).apply(0, { question: 'q', action: 'choose', option: 'a' })
  await nextTick()
  expect(first.querySelector('.studio-correct-count')?.textContent).toBe('已答对 1')
  expect(second.querySelector('.studio-correct-count')?.textContent).toBe('已答对 0')
  expect(mainCount.textContent).toBe('已答对 1')
  previews[0].resetTrial()
  await nextTick()
  expect(first.querySelector('.studio-correct-count')?.textContent).toBe('已答对 0')
  expect(mainCount.textContent).toBe('已答对 1')
})

it('scores multiple-choice selections on submit and retains first-correct credit when clearing', async () => {
  const { page, runtime, mount } = setup()
  await mount(() => h(Question, { question: 'q', mode: 'multiple', options }))
  const option = (await mount(() => h(Button, { question: 'q', action: 'set-option', option: 'a' }))).querySelector('button')!
  const submit = (await mount(() => h(Button, { question: 'q', action: 'submit', label: 'Submit' }))).querySelector('button')!
  option.click()
  expect(page.question('q')?.state.result).toBeNull()
  expect(quizStore(runtime).correctCount).toBe(0)
  submit.click()
  expect(page.question('q')?.state.result).toBe('correct')
  expect(quizStore(runtime).correctCount).toBe(1)
  interactions.dispatchInteraction(runtime, { question: 'q', action: 'clear-pending' })
  expect(page.question('q')?.state.selected).toEqual([])
  expect(quizStore(runtime).correctCount).toBe(1)
})
