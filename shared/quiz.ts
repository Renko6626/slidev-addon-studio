/** Source configuration and transient answer state for Studio's two question types. */
export type QuizMode = 'single' | 'multiple'
export interface QuizOption { id: string, label: string, correct: boolean }
export type QuizSignal =
  | { question: string, action: 'choose', option: string }
  | { question: string, action: 'set-option', option: string, selected: boolean }
  | { question: string, action: 'submit' }
  | { question: string, action: 'clear-pending' }

export type QuizResult = 'correct' | 'incorrect'
export interface QuizState {
  selected: string[]
  result: QuizResult | null
  attempts: number
}
export interface QuizConfiguration {
  mode: QuizMode
  options: QuizOption[]
  correctText: string
  incorrectText: string
  idleText: string
}

export function createQuizState(): QuizState {
  return { selected: [], result: null, attempts: 0 }
}

/** Null rejects an inapplicable action. Every accepted answer can be retried. */
export function applyQuizSignal(configuration: Pick<QuizConfiguration, 'mode' | 'options'>, state: QuizState, signal: QuizSignal): QuizState | null {
  if (signal.action === 'clear-pending')
    return { ...state, selected: [], result: null }

  if (signal.action === 'choose') {
    const option = configuration.options.find(option => option.id === signal.option)
    if (configuration.mode !== 'single' || !option) return null
    return { selected: [option.id], result: option.correct ? 'correct' : 'incorrect', attempts: state.attempts + 1 }
  }

  if (signal.action === 'set-option') {
    if (configuration.mode !== 'multiple' || !configuration.options.some(option => option.id === signal.option)) return null
    if (state.selected.includes(signal.option) === signal.selected) return state
    const selected = signal.selected ? [...state.selected, signal.option] : state.selected.filter(id => id !== signal.option)
    return { ...state, selected, result: null }
  }

  if (signal.action === 'submit' && configuration.mode === 'multiple' && state.selected.length) {
    const correct = configuration.options.filter(option => option.correct).map(option => option.id)
    const matches = correct.length === state.selected.length && correct.every(id => state.selected.includes(id))
    return { ...state, result: matches ? 'correct' : 'incorrect', attempts: state.attempts + 1 }
  }
  return null
}
