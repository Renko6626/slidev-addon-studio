import { computed, readonly, shallowReactive } from 'vue'
import type { ComputedRef, DeepReadonly } from 'vue'
import type { QuizConfiguration, QuizSignal } from '../shared/quiz'
import type { InteractionQuestion, StudioRuntime } from './types'
import { quizStore } from './stores/quiz'

export type { InteractionQuestion } from './types'
export interface InteractionPage {
  active: ComputedRef<boolean>
  question: (id: string) => DeepReadonly<InteractionQuestion> | undefined
  registerQuestion: (id: string, configuration: QuizConfiguration) => () => void
  /** The source page must be active, including for mouse/keyboard-generated signals. */
  dispatch: (signal: QuizSignal) => boolean
  dispose: () => void
}
interface RegisteredPage extends InteractionPage { receive: (signal: QuizSignal) => boolean }
const pages = new WeakMap<StudioRuntime, Set<RegisteredPage>>()

/** Route one signal to one active main slide instance; never broadcast or queue. */
export function dispatchInteraction(runtime: StudioRuntime, signal: QuizSignal): boolean {
  if (!runtime.canRunServices.value) return false
  const candidates = [...(pages.get(runtime) ?? [])].filter(page => page.active.value && page.question(signal.question))
  return candidates.length === 1 ? candidates[0].receive(signal) : false
}

/** Mounted wrappers own receivers; the store retains trial records after unmount. */
export function createInteractionPage(runtime: StudioRuntime, pageNumber: () => number, isActive: () => boolean): InteractionPage {
  const store = quizStore(runtime)
  const questions = shallowReactive(new Map<string, symbol>())
  const active = computed(() => runtime.canRunServices.value && isActive())
  let registered = pages.get(runtime)
  if (!registered) { registered = new Set(); pages.set(runtime, registered) }
  const page: RegisteredPage = {
    active,
    question: id => {
      const question = questions.has(id) ? store.records[pageNumber()]?.[id] : undefined
      return question ? readonly(question) : undefined
    },
    registerQuestion(id, configuration) {
      const token = Symbol()
      store.register(pageNumber(), id, configuration)
      questions.set(id, token)
      return () => { if (questions.get(id) === token) questions.delete(id) }
    },
    dispatch: signal => active.value && questions.has(signal.question) && dispatchInteraction(runtime, signal),
    receive: signal => active.value && questions.has(signal.question) && store.apply(pageNumber(), signal),
    dispose() { registered.delete(page); questions.clear() },
  }
  registered.add(page)
  return page
}
