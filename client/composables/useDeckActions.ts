import { useNav } from '@slidev/client'
import { useDynamicSlideInfo } from '@slidev/client/composables/useSlideInfo.ts'
import { until } from '@vueuse/core'
import { t } from '../i18n'
import { clearSelection, busy, editing, reportError } from '../state'
import { deckApi, type DeckResult } from './useDeckApi'
import { useStudioHistory } from './useSlideSource'

/** Shared by the ribbon and filmstrip. */
export function useDeckActions() {
  const nav = useNav()
  const history = useStudioHistory()

  async function openInsertedPage({ no, total }: DeckResult) {
    const { info } = useDynamicSlideInfo(no)
    busy.value = true
    try {
      // A middle insertion reuses an existing number. Wait for both the new
      // route table and its matching editor source before allowing edits.
      const target = await until(() => {
        if (nav.total.value < total) return
        const route = nav.slides.value[no - 1]
        if (route && info.value?.revision === route.meta.slide.revision) return route
      }).toMatch(Boolean, { timeout: 10000 })
      if (!target) {
        reportError(t('insertedSlideRefresh', { number: no }))
        return
      }
      await target.load()
      await nav.go(no)
    }
    catch (error) { reportError(error) }
    finally { busy.value = false }
  }

  async function run(action: () => ReturnType<typeof deckApi.insert>, inserted = false) {
    if (busy.value || editing.value)
      return
    const result = await action()
    if (!result)
      return
    history.reset()
    clearSelection()
    if (inserted) {
      await openInsertedPage(result)
      return result
    }
    const path = window.location.pathname.replace(/\/\d+$/, `/${result.no}`)
    window.history.replaceState(null, '', path + window.location.search + window.location.hash)
    nav.go(Math.min(result.no, nav.total.value))
    return result
  }

  return {
    add: (after: number, content?: string, frontmatter?: string) => run(() => deckApi.insert(after, content, frontmatter), true),
    duplicate: (no: number) => run(() => deckApi.duplicate(no)),
    remove: (no: number) => run(() => deckApi.remove(no)),
    move: (no: number, to: number) => run(() => deckApi.move(no, to)),
  }
}
