import type { StudioContext } from '../context'
import { action, t } from '../i18n'
import { captureBlock, decodeClipboard, encodeClipboard, insertCopiedBlock, OBJECT_CLIPBOARD_TYPE } from '../md/clipboard'
import { activePanel, busy, editing, library, reportError, ribbonTab, selection, selectedTargets, studioOpen, tableCell, tableEditing, tableRange } from '../state'
import { captureBlocks, combineCopiedBlocks, insertCopiedBlocks, splitCopiedBlocks } from '../md/batch'
import { appendElement } from '../md/elements'
import { tableSelectionRect } from '../md/table-cell'
import { copyTableCells, decodeTableTSV, encodeTableTSV, pasteTableCells } from '../md/table-clipboard'
import { readTable, tableSnippet, writeTable } from '../md/table'
import { onDomEvent } from './useDomEvent'
import { imagePending, useImageInsertion } from './useImageInsertion'
import { assetKind } from '../../shared/assets'
import { TABLE_DEFAULTS } from '../../shared/table'
import { cellHTMLFromText } from '../../shared/table-html'

/** Native clipboard events work without requesting async clipboard permissions. */
export function useObjectClipboard(studio: StudioContext, deck = window.location.origin + import.meta.env.BASE_URL) {
  const images = useImageInsertion(studio)
  let previous = ''
  let destination = 0
  let count = 0

  function available(event: Event) {
    if (event.defaultPrevented || !studioOpen.value || ribbonTab.value === 'file' || editing.value || tableEditing.value || busy.value || imagePending.value)
      return false
    const inField = (target: EventTarget | null) => typeof Element !== 'undefined' && target instanceof Element
      && (target.closest('input, textarea, select') || (target as HTMLElement).isContentEditable)
    return !inField(event.target) && !inField(document.activeElement)
  }

  function selectedTableRange() {
    const target = selection.value
    return selectedTargets.value.length === 1 && target?.no === studio.no() && target.tag === 'StudioTable'
      ? target.range
      : null
  }

  function pasteTable(event: ClipboardEvent, clipboard: DataTransfer) {
    const text = clipboard.getData('text/plain')
    if (!text && !clipboard.types?.includes('text/plain'))
      return
    const target = selectedTableRange()
    if (!target && selection.value)
      return
    const matrix = decodeTableTSV(text)
    const fromTable = /<table[\s>]/i.test(clipboard.getData('text/html'))
    const grid = matrix[0].length > 1 || (matrix.length > 1 && fromTable)
    const explicitCell = !!(tableRange.value || tableCell.value)
    if (!grid && !(target && explicitCell))
      return
    const cells = grid || fromTable ? matrix : [[text]]
    if (!studio.sourceReady()) {
      event.preventDefault()
      reportError(new Error(t('clipboardPageLoading')))
      return
    }
    const content = studio.content()
    if (target) {
      const { table, unparsed } = readTable(content, target)
      const start = explicitCell
        ? tableSelectionRect(table, tableCell.value, tableRange.value)
        : { rowStart: table.header ? -1 : 0, columnStart: 0 }
      if (unparsed || !start)
        return
      event.preventDefault()
      const next = pasteTableCells(table, start.rowStart, start.columnStart, cells)
      if (!next) {
        reportError(new Error(t('clipboardTableMergeOverlap')))
        return
      }
      void studio.commit(writeTable(content, target, next), action('actionPasteTable')).catch(reportError)
      return
    }
    event.preventDefault()
    const no = studio.no()
    const inserted = appendElement(content, tableSnippet({
      ...TABLE_DEFAULTS, header: false, columns: cells[0].map(() => ({ label: '' })), rows: cells,
    }))
    void (async () => {
      await studio.commit(inserted.content, action('actionPasteTable'))
      if (studio.no() === no && studioOpen.value && await studio.selectInserted('StudioTable', inserted.range)) {
        activePanel.value = 'inspect'
        library.value = null
      }
    })().catch(reportError)
  }

  onDomEvent<ClipboardEvent>(document, 'copy', event => {
    const target = selection.value
    if (!available(event) || !studio.sourceReady() || !target?.range || target.no !== studio.no()
      || target.kind === 'list-item' || !event.clipboardData)
      return
    if (document.getSelection?.()?.isCollapsed === false)
      return
    if (target.kind === 'list' && target.el.parentElement?.closest('li'))
      return
    if (selectedTableRange() && (tableRange.value || tableCell.value)) {
      const { table, unparsed } = readTable(studio.content(), target.range)
      const rect = tableSelectionRect(table, tableCell.value, tableRange.value)
      if (unparsed || !rect)
        return
      const cells = copyTableCells(table, rect)
      event.clipboardData.setData('text/plain', encodeTableTSV(cells))
      // HTML distinguishes one-column TSV from ordinary single-cell or multiline text.
      const rows = cells.map(row => `<tr>${row.map(cell => `<td>${cellHTMLFromText(cell)}</td>`).join('')}</tr>`).join('')
      event.clipboardData.setData('text/html', `<table>${rows}</table>`)
      event.preventDefault()
      previous = ''
      count = 0
      return
    }
    if (target.nested)
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
    if (!copied) {
      const files = [...(event.clipboardData.files ?? [])]
      if (!files.length) {
        for (const item of event.clipboardData.items ?? []) {
          if (item.kind === 'file') {
            const file = item.getAsFile()
            if (file) files.push(file)
          }
        }
      }
      const image = files.find(file => file.type.startsWith('image/') || assetKind(file.name) === 'image')
      if (image) {
        event.preventDefault()
        void images.fromClipboard(image)
      }
      else {
        pasteTable(event, event.clipboardData)
      }
      return
    }
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
