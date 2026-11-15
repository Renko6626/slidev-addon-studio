import { useSlideContext } from '@slidev/client'
import { computed, onScopeDispose } from 'vue'
import { createInteractionPage } from '../interactions'
import type { InteractionPage } from '../interactions'
import type { StudioContext, StudioRuntime } from '../types'
import { useStudioContext } from './useStudioContext'

const instances = new WeakMap<StudioRuntime, WeakMap<object, { page: InteractionPage, users: number }>>()
const globalPage: InteractionPage = {
  active: computed(() => false), question: () => undefined,
  registerQuestion: () => () => {}, dispatch: () => false, dispose: () => {},
}

/** Original SlideWrapper refs identify main receivers; preview siblings share their provider. */
export function useInteractionPage(context: StudioContext = useStudioContext()): InteractionPage {
  if (context.view.value === 'global') return globalPage
  const preview = context.view.value === 'preview' && context.page.value === null
  // Palette previews have no SlideWrapper. Resolve them before accessing Slidev.
  const key = preview ? context.runtime : useSlideContext().$page
  let runtimeInstances = instances.get(context.runtime)
  if (!runtimeInstances) { runtimeInstances = new WeakMap(); instances.set(context.runtime, runtimeInstances) }
  let instance = runtimeInstances.get(key)
  if (!instance) {
    instance = { users: 0, page: createInteractionPage(context.runtime, () => preview ? 0 : context.page.value!, () => context.active.value) }
    runtimeInstances.set(key, instance)
  }
  const current = instance
  current.users++
  onScopeDispose(() => {
    if (--current.users === 0) { current.page.dispose(); runtimeInstances.delete(key) }
  })
  return current.page
}
