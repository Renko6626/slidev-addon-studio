import { computed, reactive, readonly, ref, shallowReactive } from 'vue'
import type { ComputedRef, DeepReadonly } from 'vue'
import { applyQuizSignal, createQuizState } from '../shared/quiz'
import type { QuizConfiguration, QuizSignal, QuizState } from '../shared/quiz'

export interface InteractionQuestion {
  configuration: QuizConfiguration
  state: QuizState
}
export interface InteractionPage {
  active: ComputedRef<boolean>
  question: (id: string) => DeepReadonly<InteractionQuestion> | undefined
  registerQuestion: (id: string, configuration: QuizConfiguration) => () => void
  /** The source page must be active, including for mouse/keyboard-generated signals. */
  dispatch: (signal: QuizSignal) => boolean
  dispose: () => void
}
interface RegisteredPage extends InteractionPage {
  receive: (signal: QuizSignal) => boolean
  reset: () => void
}

const editing = ref(false)
export const interactionEditing = readonly(editing)
const pages = new Set<RegisteredPage>()

/** Start a fresh trial only when crossing the editor/presentation boundary. */
export function setInteractionEditing(value: boolean) {
  if (editing.value === value) return
  editing.value = value
  for (const page of pages) page.reset()
}

/** Route one signal to one active main slide instance; never broadcast or queue. */
export function dispatchInteraction(signal: QuizSignal): boolean {
  const candidates = [...pages].filter(page => page.active.value && page.question(signal.question))
  return candidates.length === 1 ? candidates[0].receive(signal) : false
}

/** A mounted SlideWrapper owns this session, separate from previews of the same page. */
export function createInteractionPage(isActive: () => boolean): InteractionPage {
  const questions = shallowReactive(new Map<string, InteractionQuestion>())
  const active = computed(() => !editing.value && isActive())
  const page: RegisteredPage = {
    active,
    question: id => {
      const question = questions.get(id)
      return question ? readonly(question) : undefined
    },
    registerQuestion(id, configuration) {
      const question = reactive({ configuration, state: createQuizState() })
      questions.set(id, question)
      return () => { if (questions.get(id) === question) questions.delete(id) }
    },
    dispatch: signal => active.value && questions.has(signal.question) && dispatchInteraction(signal),
    receive(signal) {
      const question = questions.get(signal.question)
      if (!active.value || !question) return false
      const next = applyQuizSignal(question.configuration, question.state, signal)
      if (!next) return false
      question.state = next
      return true
    },
    reset() { for (const question of questions.values()) question.state = createQuizState() },
    dispose() { pages.delete(page); questions.clear() },
  }
  pages.add(page)
  return page
}
