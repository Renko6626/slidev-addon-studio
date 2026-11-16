import { describe, expect, it } from 'vitest'
import { applyQuizSignal, createQuizState } from '../shared/quiz'

const options = [
  { id: 'a', correct: true },
  { id: 'b', correct: false },
  { id: 'c', correct: true },
]

describe('question answer rules', () => {
  it('judges every single-choice attempt, including selecting the same answer again', () => {
    const configuration = { mode: 'single' as const, options }
    const wrong = applyQuizSignal(configuration, createQuizState(), { question: 'q', action: 'choose', option: 'b' })!
    expect(wrong).toEqual({ selected: ['b'], result: 'incorrect', attempts: 1 })
    const right = applyQuizSignal(configuration, wrong, { question: 'q', action: 'choose', option: 'a' })!
    expect(right).toEqual({ selected: ['a'], result: 'correct', attempts: 2 })
    expect(applyQuizSignal(configuration, right, { question: 'q', action: 'choose', option: 'a' })?.attempts).toBe(3)
  })

  it('requires an exact nonempty multiple-choice set and drops a judgement when selection changes', () => {
    const configuration = { mode: 'multiple' as const, options }
    let state = createQuizState()
    expect(applyQuizSignal(configuration, state, { question: 'q', action: 'submit' })).toBeNull()
    state = applyQuizSignal(configuration, state, { question: 'q', action: 'set-option', option: 'a', selected: true })!
    state = applyQuizSignal(configuration, state, { question: 'q', action: 'submit' })!
    expect(state.result).toBe('incorrect')
    state = applyQuizSignal(configuration, state, { question: 'q', action: 'set-option', option: 'c', selected: true })!
    expect(state.result).toBeNull()
    state = applyQuizSignal(configuration, state, { question: 'q', action: 'submit' })!
    expect(state).toEqual({ selected: ['a', 'c'], result: 'correct', attempts: 2 })
    expect(applyQuizSignal(configuration, state, { question: 'q', action: 'set-option', option: 'c', selected: true })).toBe(state)
    state = applyQuizSignal(configuration, state, { question: 'q', action: 'set-option', option: 'b', selected: true })!
    expect(applyQuizSignal(configuration, state, { question: 'q', action: 'submit' })?.result).toBe('incorrect')
    state = applyQuizSignal(configuration, state, { question: 'q', action: 'clear-pending' })!
    expect(state).toEqual({ selected: [], result: null, attempts: 2 })
  })

  it('rejects unknown options and actions for the other question type', () => {
    const state = createQuizState()
    expect(applyQuizSignal({ mode: 'single', options }, state, { question: 'q', action: 'choose', option: 'missing' })).toBeNull()
    expect(applyQuizSignal({ mode: 'single', options }, state, { question: 'q', action: 'set-option', option: 'a', selected: true })).toBeNull()
    expect(applyQuizSignal({ mode: 'multiple', options }, state, { question: 'q', action: 'choose', option: 'a' })).toBeNull()
    expect(state).toEqual(createQuizState())
  })
})
