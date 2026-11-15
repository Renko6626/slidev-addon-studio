import { effectScope, nextTick, ref } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'

// Supply the host's router/fullscreen; exercise Studio's actual watchers and state.
vi.mock('@slidev/client', async () => {
  const { ref } = await import('vue')
  const currentRoute = ref({ query: { studio: '1', clicks: '2' } })
  return { useNav: () => ({ router: {
    currentRoute,
    replace: async (location: typeof currentRoute.value) => { currentRoute.value = location },
  } }) }
})
vi.mock('@slidev/client/state/index.ts', async () => {
  const { ref } = await import('vue')
  return { fullscreen: { isFullscreen: ref(false), enter: async () => {} } }
})

import { useNav } from '@slidev/client'
import { useEditorMode } from '../client/composables/useEditorMode'
import { editing, selection, studioOpen } from '../client/state'
import type { StudioTarget } from '../client/types'
import { fullscreen } from '@slidev/client/state/index.ts'
import { createInteractionPage, setInteractionEditing } from '../runtime/interactions'

let scope = effectScope()
afterEach(() => {
  scope.stop()
  editing.value = false
  selection.value = null
  studioOpen.value = false
  fullscreen.isFullscreen.value = false
  setInteractionEditing(false)
  vi.restoreAllMocks()
})

describe('editor mode', () => {
  it('keeps the active title selected when a shortcut tries to close an unfinished edit', async () => {
    useNav().router.currentRoute.value.query = { studio: '1', clicks: '2' }
    scope = effectScope()
    scope.run(useEditorMode)
    const title: StudioTarget = {
      el: {} as HTMLElement, no: 1, range: null, kind: 'frontmatter',
      prop: 'title', positioned: false, nested: false, label: 'Title',
    }
    selection.value = title
    editing.value = true

    studioOpen.value = false
    await nextTick()

    expect(studioOpen.value).toBe(true)
    expect(editing.value).toBe(true)
    expect(selection.value).toBe(title)
    expect(useNav().router.currentRoute.value.query).toEqual({ studio: '1', clicks: '2' })
  })

  it('switches preview and editing without dropping other route parameters', async () => {
    useNav().router.currentRoute.value.query = { studio: '1', clicks: '2' }
    scope = effectScope()
    const mode = scope.run(useEditorMode)!
    mode.preview()
    await nextTick()
    expect(studioOpen.value).toBe(false)
    expect(mode.previewing.value).toBe(true)
    expect(useNav().router.currentRoute.value.query).toEqual({ studio: '0', clicks: '2' })

    mode.returnToEditor()
    await nextTick()
    expect(studioOpen.value).toBe(true)
    expect(mode.previewing.value).toBe(false)
    expect(useNav().router.currentRoute.value.query).toEqual({ studio: '1', clicks: '2' })
  })

  it('resets at editor boundaries, preserves pages during preview and keeps the same fullscreen trial', async () => {
    const current = ref(1)
    const pages = [1, 2].map(no => createInteractionPage(() => current.value === no))
    const configuration = { mode: 'single' as const, options: [{ id: 'a', label: 'A', correct: true }], correctText: 'Correct', incorrectText: 'Retry', idleText: '' }
    pages.forEach(page => page.registerQuestion('q1', configuration))
    setInteractionEditing(false)
    pages[0].dispatch({ question: 'q1', action: 'choose', option: 'a' })
    useNav().router.currentRoute.value.query = { studio: '1' }
    scope = effectScope()
    const mode = scope.run(useEditorMode)!
    try {
      expect(pages[0].active.value).toBe(false)
      expect(pages[0].question('q1')?.state.attempts).toBe(0)
      mode.preview()
      await nextTick()
      expect(pages[0].dispatch({ question: 'q1', action: 'choose', option: 'a' })).toBe(true)
      current.value = 2
      expect(pages[0].dispatch({ question: 'q1', action: 'choose', option: 'a' })).toBe(false)
      expect(pages[0].question('q1')?.state.result).toBe('correct')
      expect(pages[1].question('q1')?.state.result).toBeNull()
      current.value = 1
      vi.spyOn(fullscreen, 'enter').mockImplementation(async () => { fullscreen.isFullscreen.value = true })
      await mode.present()
      expect(pages[0].question('q1')?.state.attempts).toBe(1)
      fullscreen.isFullscreen.value = false
      await nextTick()
      expect(studioOpen.value).toBe(true)
      expect(pages[0].question('q1')?.state.result).toBeNull()
      expect(pages[0].question('q1')?.state.selected).toEqual([])
    }
    finally { pages.forEach(page => page.dispose()) }
  })
})
