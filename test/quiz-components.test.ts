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
import { injectionCurrentPage, injectionRenderContext } from '@slidev/client/constants.ts'
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
const options = [{ id: 'a', correct: true }, { id: 'b', correct: false }]
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
  const current = ref({ question: 'q', mode: 'single', options })
  await mount(() => h(Question, current.value))
  interactions.dispatchInteraction(runtime, { question: 'q', action: 'choose', option: 'a' })
  current.value = { ...current.value, options: options.map(option => ({ ...option })) }
  await nextTick()
  expect(page.question('q')?.state).toEqual({ selected: ['a'], result: 'correct', attempts: 1 })
  current.value = { ...current.value, options: [{ ...options[0], correct: false }, options[1]] }
  await nextTick()
  expect(page.question('q')?.state).toEqual({ selected: [], result: null, attempts: 0 })
})

it('keeps hidden controls running when independent prompt objects are removed', async () => {
  const { page, runtime, mount } = setup()
  const presentation = ref('hidden'), titleVisible = ref(true)
  const control = await mount(() => h(Question, { question: 'q', name: 'Question 1', presentation: presentation.value, options }))
  const prompt = await mount(() => titleVisible.value ? h('div', { 'data-studio-element': 'text', 'data-studio-question-ref': 'q' }, 'Which answer?') : null)
  const button = (await mount(() => h(Button, { question: 'q', action: 'choose', option: 'a', contentHtml: '<p>Option A</p>' }))).querySelector<HTMLElement>('.studio-quiz-button')!
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
  await mount(() => h(Question, { question: 'q', options }))
  const contentHtml = ref('<p>Option A</p>'), correctText = ref('Yes')
  const container = await mount(() => h(Button, { question: 'q', action: 'choose', option: 'a', contentHtml: contentHtml.value }))
  const feedback = await mount(() => h(Feedback, { question: 'q', effect: 'pop', correctText: correctText.value, idleText: 'Choose' }))
  const button = container.querySelector<HTMLElement>('.studio-quiz-button')!
  expect(button.querySelector('[data-studio-field="contentHtml"]')?.textContent).toBe('Option A')
  expect(button.querySelector('.studio-quiz-button__option')?.textContent).toBe('a')
  expect(button.dataset.studioQuestionRef).toBe('q')
  expect((feedback.firstElementChild as HTMLElement).dataset.studioQuestionRef).toBe('q')
  const deckClick = vi.fn(), deckKey = vi.fn()
  container.addEventListener('click', deckClick); container.addEventListener('keydown', deckKey)
  button.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  await nextTick()
  expect(page.question('q')?.state.attempts).toBe(1)
  expect(deckClick).not.toHaveBeenCalled()
  expect(feedback.textContent).toBe('Yes')
  contentHtml.value = '<p>Reworded answer</p>'
  correctText.value = 'Well done'
  await nextTick()
  expect(button.querySelector('[data-studio-field="contentHtml"]')?.textContent).toBe('Reworded answer')
  expect(feedback.textContent).toBe('Well done')
  expect(page.question('q')?.state).toMatchObject({ selected: ['a'], result: 'correct', attempts: 1 })
  for (const key of ['Enter', ' ']) {
    const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true })
    button.dispatchEvent(event)
    expect(event.defaultPrevented).toBe(true)
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
  const Card = loadVueComponent(resolve(process.cwd(), 'playground/components/EditableOptionCard.vue'), { '../../runtime': runtimeApi })
  const Count = component('StudioCorrectCount')
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
    return () => [h(Question, { question: 'q', options }), h('div', { 'data-studio-element': 'text', 'data-studio-question-ref': 'q' }, 'Preview question'), h(Button, { question: 'q', action: 'choose', option: 'a', contentHtml: '<p>Option A</p>' }), h(Card, { question: 'q', option: 'a' }), h(Count)]
  } })
  const reads = host.readSlide.mock.calls.length
  const first = await mount(() => h(Preview))
  const second = await mount(() => h(Preview))
  expect(host.readSlide.mock.calls.length).toBe(reads)
  expect(first.querySelector('[data-studio-element="text"]')?.textContent).toBe('Preview question')
  expect(first.querySelector('[data-studio-field="contentHtml"]')?.textContent).toBe('Option A')
  expect(first.querySelector('.studio-correct-count')?.textContent).toBe('已答对 0')
  first.querySelector<HTMLElement>('.studio-quiz-button')!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  first.querySelector<HTMLElement>('[data-studio-component="EditableOptionCard"]')!.click()
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
  const option = (await mount(() => h(Button, { question: 'q', action: 'set-option', option: 'a' }))).querySelector<HTMLElement>('.studio-quiz-button')!
  const submit = (await mount(() => h(Button, { question: 'q', action: 'submit', contentHtml: '<p>Submit</p>' }))).querySelector<HTMLElement>('.studio-quiz-button')!
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


it.each(['single', 'multiple'] as const)('runs a field-based option through existing %s actions and keeps editing inert', async mode => {
  const Card = loadVueComponent(resolve(process.cwd(), 'playground/components/EditableOptionCard.vue'), { '../../runtime': runtimeApi })
  const { page, runtime, mount } = setup()
  await mount(() => h(Question, { question: 'q', mode, options }))
  const container = await mount(() => h(Card, { question: 'q', option: 'a', contentHtml: '<p>My <strong>answer</strong></p>', imageSrc: '/samples/landscape.svg', imageAlt: 'Landscape' }))
  const card = container.querySelector<HTMLElement>('[data-studio-component]')!
  expect(card.querySelector('[data-studio-field="contentHtml"] strong')?.textContent).toBe('answer')
  expect(card.querySelector('img')?.getAttribute('alt')).toBe('Landscape')
  setRuntimeEditing(runtime, true)
  card.click()
  expect(page.question('q')?.state.selected).toEqual([])
  setRuntimeEditing(runtime, false)
  card.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }))
  await nextTick()
  expect(card.getAttribute('aria-pressed')).toBe('true')
  expect(page.question('q')?.state.selected).toEqual(['a'])
  if (mode === 'multiple') {
    expect(card.dataset.quizAppearance).toBe('selected')
    interactions.dispatchInteraction(runtime, { question: 'q', action: 'submit' })
    await nextTick()
  }
  expect(card.dataset.quizAppearance).toBe('correct')
  expect(page.question('q')?.state.result).toBe('correct')
  interactions.dispatchInteraction(runtime, { question: 'q', action: 'clear-pending' })
  const other = (await mount(() => h(Card, { question: 'q', option: 'b', contentHtml: '<p>Other</p>' }))).querySelector<HTMLElement>('[data-studio-component]')!
  other.click()
  if (mode === 'multiple') interactions.dispatchInteraction(runtime, { question: 'q', action: 'submit' })
  await nextTick()
  expect(other.dataset.quizAppearance).toBe('incorrect')
  expect(page.question('q')?.state.result).toBe('incorrect')
})
