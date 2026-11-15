import { afterEach, expect, it, vi } from 'vitest'
import { effectScope, ref } from 'vue'
import type { EffectScope, Ref } from 'vue'
import { createInteractionPage, dispatchInteraction, setInteractionEditing } from '../runtime/interactions'
import { useInteractionPage } from '../runtime/useInteractionPage'

// Only Slidev's injected host context is replaced; scope sharing and dispatch are production code.
const host = vi.hoisted(() => ({ context: null as any, nav: null as any }))
vi.mock('@slidev/client', () => ({ useSlideContext: () => host.context, useNav: () => host.nav }))
const configuration = {
  mode: 'single' as const,
  options: [{ id: 'a', label: 'A', correct: true }, { id: 'b', label: 'B', correct: false }],
  correctText: 'Correct', incorrectText: 'Try again', idleText: 'Choose',
}
const scopes: EffectScope[] = []
afterEach(() => { scopes.splice(0).forEach(scope => scope.stop()); setInteractionEditing(false) })
function setup() {
  host.nav = { currentSlideNo: ref(1), isPrintMode: ref(false), isNotesViewer: ref(false), isPresenter: ref(false) }
  function mount(context: { $page: Ref<number>, $renderContext: Ref<string> }) {
    host.context = context
    const scope = effectScope()
    scopes.push(scope)
    const page = scope.run(useInteractionPage)!
    return { page, scope }
  }
  return { mount, context: (no: number, render = 'slide') => ({ $page: ref(no), $renderContext: ref(render) }) }
}

it('shares sibling objects but isolates pre-mounted slides, thumbnails, presenter views and print', () => {
  const app = setup()
  const firstContext = app.context(1)
  const first = app.mount(firstContext)
  const sibling = app.mount(firstContext)
  const second = app.mount(app.context(2))
  const thumbnail = app.mount(app.context(1, 'previewNext'))
  const presenter = app.mount(app.context(1, 'presenter'))
  for (const { page } of [first, second, thumbnail, presenter]) page.registerQuestion('q', configuration)
  expect(sibling.page).toBe(first.page)
  expect(thumbnail.page.dispatch({ question: 'q', action: 'choose', option: 'b' })).toBe(false)
  expect(second.page.dispatch({ question: 'q', action: 'choose', option: 'b' })).toBe(false)
  expect(dispatchInteraction({ question: 'q', action: 'choose', option: 'a' })).toBe(true)
  expect(first.page.question('q')?.state.result).toBe('correct')
  expect(second.page.question('q')?.state.attempts).toBe(0)
  expect(thumbnail.page.question('q')?.state.attempts).toBe(0)
  expect(presenter.page.question('q')?.state.attempts).toBe(0)

  host.nav.currentSlideNo.value = 2
  expect(first.page.dispatch({ question: 'q', action: 'choose', option: 'b' })).toBe(false)
  expect(dispatchInteraction({ question: 'q', action: 'choose', option: 'b' })).toBe(true)
  expect(second.page.question('q')?.state.result).toBe('incorrect')
  host.nav.currentSlideNo.value = 1
  expect(first.page.question('q')?.state.result).toBe('correct')
  for (const key of ['isPrintMode', 'isNotesViewer', 'isPresenter']) {
    host.nav[key].value = true
    expect(dispatchInteraction({ question: 'q', action: 'clear-pending' })).toBe(false)
    host.nav[key].value = false
  }
  first.scope.stop()
  expect(sibling.page.question('q')?.state.result).toBe('correct')
  sibling.scope.stop()
  expect(dispatchInteraction({ question: 'q', action: 'clear-pending' })).toBe(false)
})

it('resets on editor boundaries, retaining a trial when non-editing mode is set again', () => {
  const app = setup()
  const { page } = app.mount(app.context(1))
  page.registerQuestion('q', configuration)
  setInteractionEditing(true)
  expect(dispatchInteraction({ question: 'q', action: 'choose', option: 'a' })).toBe(false)
  setInteractionEditing(false)
  expect(dispatchInteraction({ question: 'q', action: 'choose', option: 'a' })).toBe(true)
  setInteractionEditing(false)
  expect(page.question('q')?.state.attempts).toBe(1)
  setInteractionEditing(true)
  expect(page.question('q')?.state).toEqual({ selected: [], result: null, attempts: 0 })
  setInteractionEditing(false)
  expect(page.question('q')?.state.attempts).toBe(0)
})

it('routes to one question and unregisters the current definition without keeping stale state', () => {
  const app = setup()
  const { page } = app.mount(app.context(1))
  const unregister = page.registerQuestion('q', configuration)
  page.registerQuestion('other', configuration)
  expect(dispatchInteraction({ question: 'q', action: 'choose', option: 'a' })).toBe(true)
  expect(page.question('other')?.state.attempts).toBe(0)
  unregister()
  expect(dispatchInteraction({ question: 'q', action: 'choose', option: 'a' })).toBe(false)
  page.registerQuestion('q', configuration)
  expect(page.question('q')?.state.attempts).toBe(0)
})

it('rejects an ambiguous pair of active main instances instead of broadcasting', () => {
  const first = createInteractionPage(() => true), second = createInteractionPage(() => true)
  try {
    first.registerQuestion('q', configuration); second.registerQuestion('q', configuration)
    expect(dispatchInteraction({ question: 'q', action: 'choose', option: 'a' })).toBe(false)
    expect(first.question('q')?.state.attempts).toBe(0)
    expect(second.question('q')?.state.attempts).toBe(0)
  }
  finally { first.dispose(); second.dispose() }
})
