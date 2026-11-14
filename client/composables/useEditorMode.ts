import { useNav } from '@slidev/client'
import { fullscreen } from '@slidev/client/state/index.ts'
import { ref, watch } from 'vue'
import { editorOpenFromQuery } from '../editor-view'
import { busy, clearSelection, editing, library, reportError, studioOpen } from '../state'

export function useEditorMode() {
  const { router } = useNav()
  const previewing = ref(false)
  let ownsFullscreen = false
  studioOpen.value = editorOpenFromQuery(router.currentRoute.value.query.studio, studioOpen.value)

  watch(() => router.currentRoute.value.query.studio, value => {
    const next = editorOpenFromQuery(value, studioOpen.value)
    if (!editing.value)
      studioOpen.value = next
  })

  watch(studioOpen, open => {
    // Restoring the switch re-enters this synchronous watcher. Both calls must
    // leave the text editor's selection intact (frontmatter edits need its key).
    if (editing.value) {
      if (!open)
        studioOpen.value = true
      return
    }
    library.value = null
    clearSelection()
    if (open)
      previewing.value = false
    const query = router.currentRoute.value.query
    const value = open ? '1' : '0'
    if (query.studio !== value)
      void router.replace({ query: { ...query, studio: value } }).catch(reportError)
  }, { flush: 'sync' })

  function preview() {
    if (editing.value || busy.value)
      return
    previewing.value = true
    studioOpen.value = false
  }

  async function present() {
    if (editing.value || busy.value)
      return
    preview()
    if (!fullscreen.isFullscreen.value) {
      ownsFullscreen = true
      try {
        await fullscreen.enter()
        if (!fullscreen.isFullscreen.value)
          ownsFullscreen = false
      }
      catch (error) {
        ownsFullscreen = false
        studioOpen.value = true
        reportError(error)
      }
    }
  }

  watch(fullscreen.isFullscreen, full => {
    if (!full && ownsFullscreen) {
      ownsFullscreen = false
      studioOpen.value = true
    }
  })

  return { previewing, isFullscreen: fullscreen.isFullscreen, preview, present, returnToEditor: () => (studioOpen.value = true) }
}
