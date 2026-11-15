import { useNav } from '@slidev/client'
import { computed, getCurrentInstance, onScopeDispose, watch } from 'vue'
import { getStudioRuntime, initializeRuntime, setRuntimeViewEligible } from '../runtime/app'
import { editorOpenStorageKey, initialEditorOpen } from '../shared/editor-mode'

export default function setupStudioRoot(): void {
  const runtime = getStudioRuntime(getCurrentInstance()!.appContext.app)
  const nav = useNav()
  let alive = true
  const eligible = computed(() => nav.hasPrimarySlide.value
    && !!nav.currentSlideRoute.value
    && nav.currentSlideRoute.value.no === nav.currentSlideNo.value
    && !nav.isPresenter.value && !nav.isPrintMode.value && !nav.isNotesViewer.value && !nav.isEmbedded.value)

  watch(eligible, value => setRuntimeViewEligible(runtime, value), { flush: 'sync' })
  onScopeDispose(() => {
    alive = false
    setRuntimeViewEligible(runtime, false)
  })
  void nav.router.isReady().then(() => {
    if (!alive) return
    let preference = false
    if (__DEV__ && __SLIDEV_FEATURE_EDITOR__) {
      try { preference = localStorage.getItem(editorOpenStorageKey) === 'true' }
      catch { /* Authoring preferences are optional when browser storage is unavailable. */ }
    }
    initializeRuntime(runtime, {
      editing: initialEditorOpen(nav.router.currentRoute.value.query.studio, preference, __DEV__ && __SLIDEV_FEATURE_EDITOR__),
      canRunServices: eligible.value,
    })
  }).catch(error => console.error('[slidev-studio]', error))
}
