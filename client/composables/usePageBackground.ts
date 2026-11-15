import { useMutationObserver } from '@vueuse/core'
import { ref, watch } from 'vue'
import { useStudio } from '../context'
import type { StudioContext } from '../context'
import { mappedElements } from '../dom'
import { readDrag } from '../md/drag'
import { setPageBackground } from '../md/background'
import type { PageBackground } from '../md/background'
import { action } from '../i18n'
import { activePanel, clearSelection, inspectorVisible } from '../state'

/** A page operation must not reselect objects using ranges shifted by its write. */
export async function changePageBackground(studio: Pick<StudioContext, 'content' | 'commit'>, background: PageBackground | null) {
  const next = setPageBackground(studio.content(), background)
  if (next === studio.content()) return
  clearSelection()
  activePanel.value = 'layout'
  inspectorVisible.value = true
  await studio.commit(next, action('actionBackground'))
}

/** Use the already annotated roots, including objects hidden by click steps. */
export function isFreeCanvasPage(no: number, content: string) {
  if (!setPageBackground(content, null).trim()) return true
  const roots = mappedElements(no).filter(el => el.dataset.studioNested !== '1')
  return roots.length > 0 && roots.every(el => {
    const range = el.dataset.studioSrc?.split(',').map(Number)
    return range?.length === 2 && !!readDrag(content, [range[0], range[1]])?.pos
  })
}

export function usePageBackground() {
  const studio = useStudio()
  const available = ref(false)
  function refresh() {
    available.value = studio.frontmatter().layout === 'none' && isFreeCanvasPage(studio.no(), studio.content())
  }
  watch([() => studio.no(), () => studio.content(), () => studio.frontmatter().layout], refresh, { immediate: true, flush: 'post' })
  // Source writes and the rendered page arrive separately through Slidev HMR.
  useMutationObserver(document.body, refresh, { childList: true, subtree: true })
  return { available }
}
