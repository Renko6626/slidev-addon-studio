import { defineStore } from 'pinia'
import { applyQuizSignal, createQuizState } from '../../shared/quiz'
import type { QuizConfiguration, QuizSignal } from '../../shared/quiz'
import type { InteractionQuestion, StudioRuntime } from '../types'

interface QuizRecord extends InteractionQuestion { credited: boolean }

export const useQuizStore = defineStore('studio/quiz', {
  state: () => ({ records: {} as Record<number, Record<string, QuizRecord>> }),
  getters: {
    correctCount: state => Object.values(state.records).reduce((total, page) => total + Object.values(page).filter(record => record.credited).length, 0),
  },
  actions: {
    register(page: number, id: string, configuration: QuizConfiguration) {
      const records = this.records[page] ?? (this.records[page] = Object.create(null))
      const previous = records[id]
      // Stable field order and copied options keep equivalent props and in-place edits comparable.
      const snapshot: QuizConfiguration = {
        mode: configuration.mode,
        options: configuration.options.map(({ id, correct }) => ({ id, correct })),
      }
      if (!previous || JSON.stringify(previous.configuration) !== JSON.stringify(snapshot)) {
        records[id] = { configuration: snapshot, state: createQuizState(), credited: false }
      }
    },
    apply(page: number, signal: QuizSignal): boolean {
      const record = this.records[page]?.[signal.question]
      if (!record) return false
      const next = applyQuizSignal(record.configuration, record.state, signal)
      if (!next) return false
      record.state = next
      if (next.result === 'correct') record.credited = true
      return true
    },
    resetAnswers() {
      for (const page of Object.values(this.records)) {
        for (const record of Object.values(page)) {
          record.state = createQuizState()
          record.credited = false
        }
      }
    },
  },
})

const initialized = new WeakSet<StudioRuntime>()
/** Explicit runtime selection also works outside component setup. */
export function quizStore(runtime: StudioRuntime) {
  const store = useQuizStore(runtime.pinia)
  if (!initialized.has(runtime)) {
    initialized.add(runtime)
    runtime.onReset(() => store.resetAnswers())
  }
  return store
}
