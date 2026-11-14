import type { StudioContext } from '../context'
import { action, t } from '../i18n'
import { captureBlock, decodeClipboard, encodeClipboard, insertCopiedBlock, OBJECT_CLIPBOARD_TYPE } from '../md/clipboard'
import { activePanel, busy, editing, library, reportError, selection, studioOpen } from '../state'
import { onDomEvent } from './useDomEvent'

/** Native clipboard events work without requesting async clipboard permissions. */
export function useObjectClipboard(studio: StudioContext, deck = window.location.origin + import.meta.env.BASE_URL) {
  let previous = ''
  let destination = 0
  let count = 0

  function available(event: Event) {
    if (!studioOpen.value || editing.value || busy.value)
      return false
    const inField = (target: EventTarget | null) => typeof Element !== 'undefined' && target instanceof Element
      && (target.closest('input, textarea, select') || (target as HTMLElement).isContentEditable)
    return !inField(event.target) && !inField(document.activeElement)
  }

  onDomEvent<ClipboardEvent>(document, 'copy', event => {
    const target = selection.value
    if (!available(event) || !studio.sourceReady() || !target?.range || target.no !== studio.no()
      || target.nested || target.kind === 'list-item' || !event.clipboardData)
      return
    if (target.kind === 'list' && target.el.parentElement?.closest('li'))
      return
    const copied = captureBlock(studio.content(), target.range, { deck, page: studio.no(), tag: target.tag })
    event.clipboardData.setData(OBJECT_CLIPBOARD_TYPE, encodeClipboard(copied))
    event.clipboardData.setData('text/plain', copied.source)
    event.preventDefault()
    previous = ''
    count = 0
  })

  onDomEvent<ClipboardEvent>(document, 'paste', event => {
    if (!available(event) || !event.clipboardData)
      return
    const raw = event.clipboardData.getData(OBJECT_CLIPBOARD_TYPE)
    const copied = decodeClipboard(raw, deck)
    if (!copied)
      return
    event.preventDefault()
    if (!studio.sourceReady()) {
      reportError(new Error(t('clipboardPageLoading')))
      return
    }
    const no = studio.no()
    if (previous !== raw || destination !== no) {
      count = 0
      previous = raw
      destination = no
    }
    const offset = 20 * (count + (copied.page === no ? 1 : 0))
    const inserted = insertCopiedBlock(studio.content(), copied, offset)
    count++
    void (async () => {
      await studio.commit(inserted.content, action('actionPasteObject'))
      if (studio.no() !== no || !studioOpen.value) return
      if (await studio.selectInserted(copied.tag, inserted.range)) {
        activePanel.value = 'inspect'
        library.value = null
      }
    })().catch(reportError)
  })
}
