import type { StudioContext } from '../context'
import { action, t } from '../i18n'
import { captureBlock, decodeClipboard, encodeClipboard, insertCopiedBlock, OBJECT_CLIPBOARD_TYPE } from '../md/clipboard'
import { activePanel, busy, editing, library, reportError, ribbonTab, selection, selectedTargets, studioOpen } from '../state'
import { captureBlocks, combineCopiedBlocks, insertCopiedBlocks, splitCopiedBlocks } from '../md/batch'
import { onDomEvent } from './useDomEvent'

/** Native clipboard events work without requesting async clipboard permissions. */
export function useObjectClipboard(studio: StudioContext, deck = window.location.origin + import.meta.env.BASE_URL) {
  let previous = ''
  let destination = 0
  let count = 0

  function available(event: Event) {
    if (!studioOpen.value || ribbonTab.value === 'file' || editing.value || busy.value)
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
    const copied = selectedTargets.value.length > 1
      ? combineCopiedBlocks(captureBlocks(studio.content(), selectedTargets.value.map(item => ({ range: item.range!, tag: item.tag })), { deck, page: studio.no() }))
      : captureBlock(studio.content(), target.range, { deck, page: studio.no(), tag: target.tag })
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
    const blocks = splitCopiedBlocks(copied)
    const inserted = blocks.length > 1 ? insertCopiedBlocks(studio.content(), blocks, offset) : null
    const single = inserted ? null : insertCopiedBlock(studio.content(), copied, offset)
    count++
    void (async () => {
      await studio.commit(inserted?.content ?? single!.content, action('actionPasteObject'))
      if (studio.no() !== no || !studioOpen.value) return
      if (inserted ? await studio.selectInsertedMany?.(inserted.inserted) : await studio.selectInserted(copied.tag, single!.range)) {
        activePanel.value = 'inspect'
        library.value = null
      }
    })().catch(reportError)
  })
}
