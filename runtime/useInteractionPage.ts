import { useNav, useSlideContext } from '@slidev/client'
import { onScopeDispose } from 'vue'
import { createInteractionPage } from './interactions'
import type { InteractionPage } from './interactions'

const instances = new WeakMap<object, { page: InteractionPage, users: number }>()

/** Sibling objects share their SlideWrapper's page ref, never a page number alone. */
export function useInteractionPage(): InteractionPage {
  const { $page, $renderContext } = useSlideContext()
  const nav = useNav()
  let instance = instances.get($page)
  if (!instance) {
    instance = {
      users: 0,
      page: createInteractionPage(() => $renderContext.value === 'slide'
        && $page.value === nav.currentSlideNo.value
        && !nav.isPrintMode.value && !nav.isNotesViewer.value && !nav.isPresenter.value),
    }
    instances.set($page, instance)
  }
  const current = instance
  current.users++
  onScopeDispose(() => {
    if (--current.users === 0) {
      current.page.dispose()
      instances.delete($page)
    }
  })
  return current.page
}
