import { injectLocal } from '@vueuse/core'
import { useNav, useSlideContext } from '@slidev/client'
import { injectionCurrentPage, injectionRenderContext } from '@slidev/client/constants'
import { computed, getCurrentInstance, inject } from 'vue'
import { getStudioRuntime } from '../app'
import { previewContextKey } from '../preview'
import type { StudioContext, StudioView } from '../types'

/** Component context; preview overrides must win before any required Slidev injections. */
export function useStudioContext(): StudioContext {
  const preview = inject(previewContextKey, undefined)
  if (preview) return preview

  const instance = getCurrentInstance()
  if (!instance) throw new Error('[slidev-studio] useStudioContext must be called in component setup.')
  const runtime = getStudioRuntime(instance.appContext.app)
  const injectedPage = injectLocal(injectionCurrentPage, undefined)
  const renderContext = injectLocal(injectionRenderContext, undefined)
  // Slidev's global layers can inherit the app's page number without SlideWrapper.
  if (!injectedPage || !renderContext || renderContext.value === 'none') {
    return { runtime, view: computed(() => 'global'), page: computed(() => null), active: computed(() => false) }
  }

  const { $page, $renderContext } = useSlideContext()
  const nav = useNav()
  const view = computed<StudioView>(() => {
    if ($renderContext.value === 'none') return 'global'
    if (nav.isPrintMode.value) return 'print'
    if ($renderContext.value === 'presenter' || nav.isPresenter.value || nav.isNotesViewer.value) return 'presenter'
    return $renderContext.value === 'slide' ? 'slide' : 'preview'
  })
  return {
    runtime,
    view,
    page: computed(() => view.value === 'global' ? null : $page.value),
    active: computed(() => runtime.canRunServices.value && view.value === 'slide'
      && !nav.isEmbedded.value && nav.hasPrimarySlide.value
      && nav.currentSlideRoute.value?.no === nav.currentSlideNo.value
      && $page.value === nav.currentSlideNo.value),
  }
}
