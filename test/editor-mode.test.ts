import { effectScope, nextTick } from 'vue'
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

let scope = effectScope()
afterEach(() => {
  scope.stop()
  editing.value = false
  selection.value = null
  studioOpen.value = false
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
})
