import { useNav } from '@slidev/client'
import { clearSelection, busy, editing } from '../state'
import { deckApi } from './useDeckApi'
import { useStudioHistory } from './useSlideSource'

/** Shared by the ribbon and filmstrip; keep the existing deck reload semantics. */
export function useDeckActions() {
  const nav = useNav()
  const history = useStudioHistory()

  async function run(action: () => ReturnType<typeof deckApi.insert>) {
    if (busy.value || editing.value)
      return
    const result = await action()
    if (!result)
      return
    history.reset()
    clearSelection()
    const path = window.location.pathname.replace(/\/\d+$/, `/${result.no}`)
    window.history.replaceState(null, '', path + window.location.search + window.location.hash)
    nav.go(Math.min(result.no, nav.total.value))
  }

  return {
    add: (after: number) => run(() => deckApi.insert(after)),
    duplicate: (no: number) => run(() => deckApi.duplicate(no)),
    remove: (no: number) => run(() => deckApi.remove(no)),
    move: (no: number, to: number) => run(() => deckApi.move(no, to)),
  }
}
