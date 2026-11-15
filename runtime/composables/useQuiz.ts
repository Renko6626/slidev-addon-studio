import { computed } from 'vue'
import { quizStore } from '../stores/quiz'
import { useStudioContext } from './useStudioContext'
import { useInteractionPage } from './useInteractionPage'

/** Public, page-aware quiz reads and actions, sharing this context's runtime. */
export function useQuiz() {
  const context = useStudioContext()
  const page = useInteractionPage(context)
  const store = quizStore(context.runtime)
  return {
    question: (id: string) => computed(() => page.question(id)),
    correctCount: computed(() => store.correctCount),
    dispatch: page.dispatch,
  }
}
