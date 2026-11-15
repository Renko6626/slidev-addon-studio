import { afterEach, expect, it } from 'vitest'
import { ref } from 'vue'
import { createInteractionPage, dispatchInteraction } from '../runtime/interactions'
import { createRuntimeHost, initializeRuntime, setRuntimeEditing, setRuntimeViewEligible } from '../runtime/app'
import { quizStore } from '../runtime/stores/quiz'

const configuration = {
  mode: 'single' as const,
  options: [{ id: 'a', label: 'A', correct: true }, { id: 'b', label: 'B', correct: false }],
  correctText: 'Correct', incorrectText: 'Try again', idleText: 'Choose',
}
const disposals: (() => void)[] = []
afterEach(() => disposals.splice(0).forEach(dispose => dispose()))
function setup() {
  const { runtime, dispose } = createRuntimeHost(); disposals.push(dispose)
  initializeRuntime(runtime, { editing: false, canRunServices: true })
  const current = ref(1)
  function mount(no: number, main = true) {
    const page = createInteractionPage(runtime, () => no, () => main && current.value === no)
    disposals.push(page.dispose)
    return page
  }
  return { runtime, current, mount, store: quizStore(runtime), dispatch: (signal: Parameters<typeof dispatchInteraction>[1]) => dispatchInteraction(runtime, signal) }
}

it('routes only to the current main receiver and rejects unavailable views and invalid actions', () => {
  const { current, mount, dispatch, runtime } = setup()
  const first = mount(1), second = mount(2), auxiliary = mount(1, false)
  for (const page of [first, second, auxiliary]) page.registerQuestion('q', configuration)
  expect(auxiliary.dispatch({ question: 'q', action: 'choose', option: 'b' })).toBe(false)
  expect(second.dispatch({ question: 'q', action: 'choose', option: 'b' })).toBe(false)
  expect(dispatch({ question: 'q', action: 'choose', option: 'a' })).toBe(true)
  expect(first.question('q')?.state.result).toBe('correct')
  expect(second.question('q')?.state.attempts).toBe(0)
  expect(dispatch({ question: 'missing', action: 'choose', option: 'a' })).toBe(false)
  expect(dispatch({ question: 'q', action: 'submit' })).toBe(false)
  current.value = 2
  expect(first.dispatch({ question: 'q', action: 'choose', option: 'b' })).toBe(false)
  expect(dispatch({ question: 'q', action: 'choose', option: 'b' })).toBe(true)
  expect(second.question('q')?.state.result).toBe('incorrect')
  setRuntimeViewEligible(runtime, false)
  expect(dispatch({ question: 'q', action: 'clear-pending' })).toBe(false)
  setRuntimeViewEligible(runtime, true)
  second.dispose()
  expect(dispatch({ question: 'q', action: 'clear-pending' })).toBe(false)
})

it('counts first correct answers per page, retains credit on retry/unmount, and resets changed definitions', () => {
  const { runtime, current, mount, dispatch, store } = setup()
  const first = mount(1), second = mount(2)
  let unregister = first.registerQuestion('q', configuration)
  first.registerQuestion('other', configuration)
  second.registerQuestion('q', configuration)
  for (const option of ['a', 'a', 'b']) {
    expect(dispatch({ question: 'q', action: 'choose', option })).toBe(true)
    expect(store.correctCount).toBe(1)
  }
  expect(first.question('other')?.state.attempts).toBe(0)
  dispatch({ question: 'q', action: 'clear-pending' })
  expect(store.correctCount).toBe(1)
  unregister()
  expect(dispatch({ question: 'q', action: 'choose', option: 'a' })).toBe(false)
  unregister = first.registerQuestion('q', { ...configuration, options: configuration.options.map(option => ({ ...option })) })
  expect(first.question('q')?.state.attempts).toBe(3)
  expect(store.correctCount).toBe(1)
  first.dispose()
  const remounted = mount(1)
  remounted.registerQuestion('q', configuration)
  expect(remounted.question('q')?.state.attempts).toBe(3)
  expect(store.correctCount).toBe(1)
  current.value = 2
  dispatch({ question: 'q', action: 'choose', option: 'a' })
  expect(store.correctCount).toBe(2)
  remounted.registerQuestion('q', { ...configuration, correctText: 'Changed' })
  expect(store.correctCount).toBe(1)
  expect(remounted.question('q')?.state.attempts).toBe(0)
  runtime.resetTrial()
  expect(store.correctCount).toBe(0)
  expect(second.question('q')?.configuration).toEqual(configuration)
  expect(second.question('q')?.state).toEqual({ selected: [], result: null, attempts: 0 })
})

it('resets on editor boundaries and retains the same running trial', () => {
  const { runtime, mount, dispatch, store } = setup()
  const page = mount(1); page.registerQuestion('q', configuration)
  setRuntimeEditing(runtime, true)
  expect(dispatch({ question: 'q', action: 'choose', option: 'a' })).toBe(false)
  setRuntimeEditing(runtime, false)
  dispatch({ question: 'q', action: 'choose', option: 'a' })
  setRuntimeEditing(runtime, false)
  expect(page.question('q')?.state.attempts).toBe(1)
  expect(store.correctCount).toBe(1)
  setRuntimeEditing(runtime, true)
  expect(page.question('q')?.state).toEqual({ selected: [], result: null, attempts: 0 })
  expect(store.correctCount).toBe(0)
})

it('rejects ambiguous main instances and keeps separate app runtimes isolated', () => {
  const first = setup(), second = setup()
  const one = first.mount(1), duplicate = first.mount(1), otherApp = second.mount(1)
  for (const page of [one, duplicate, otherApp]) page.registerQuestion('q', configuration)
  expect(first.dispatch({ question: 'q', action: 'choose', option: 'a' })).toBe(false)
  expect(one.question('q')?.state.attempts).toBe(0)
  expect(second.dispatch({ question: 'q', action: 'choose', option: 'a' })).toBe(true)
  expect(first.store.correctCount).toBe(0)
  expect(second.store.correctCount).toBe(1)
})
