import { action, targetName } from '../i18n'
import type { ActionLabel } from '../i18n'
import type { StudioTarget } from '../types'
import { onScopeDispose, watch } from 'vue'
import { removeBlock } from '../md/lines'
import { removePositions } from '../md/batch'
import { positionedUnit } from '../md/drag'
import { openContextMenu } from '@slidev/client/logic/contextMenu.ts'
import { belongsToSlide, mappedElements } from '../dom'
import { onDomEvent } from './useDomEvent'
import { useSelectionRebind } from './useSelectionRebind'
import { confirmQuestionRemoval } from '../actions'
import { createTargetResolver, describeTarget as describe, isMultiSelectable, isStudioChrome, isVisible, sameRange } from '../selection-target'
import { activePanel, busy, editing, editPointer, hovered, inspectorVisible, missed, selection, selectedTargets, setSelectedTargets, marquee, studioOpen } from '../state'

export function useSelection(
  no: () => number,
  content: () => string,
  remove?: (next: string, label: ActionLabel) => Promise<void>,
  startMove?: (event: PointerEvent) => void,
) {
  const { targetFrom, targetFromPoint, throughChrome } = createTargetResolver(no, content)

  function select(node: EventTarget | null) {
    const target = targetFrom(node)
    if (target)
      selection.value = target
  }

  /**
   * Right-click opens the slide's menu anywhere on the canvas side.
   *
   * Slidev binds its context menu to the slide container, and while Studio is
   * open two things sit outside it: the selection overlay and its handles,
   * teleported to `body` so the deck's transform cannot scale them, and the
   * margin that appears around the deck once it is scaled down to make room
   * for the dock. A right-click on either landed nowhere and the browser's own
   * menu came up instead, which is not the menu anyone wanted there.
   */
  onDomEvent<MouseEvent>(document, 'contextmenu', (event) => {
    if (!studioOpen.value || editing.value)
      return
    // Slidev's own escape hatch, kept working: Shift asks for the browser's.
    if (event.shiftKey)
      return

    const target = event.target
    if (!(target instanceof Element))
      return
    // The editor's own panels keep the browser's menu, which is the useful one
    // around a text field.
    if (target.closest('.studio-workspace, .studio-library, .studio-inline'))
      return

    event.preventDefault()
    openContextMenu(event.pageX, event.pageY)
  }, { capture: true })

  /**
   * Right-click selects what it points at, and then lets the menu open.
   *
   * The menu offers the selected block's own actions, so it has to be pointing
   * at something: without this, right-clicking a block you had not clicked
   * first offered nothing to act on.
   */
  onDomEvent<PointerEvent>(document, 'pointerdown', (event) => {
    if (!studioOpen.value || event.button !== 2 || editing.value)
      return
    if (isStudioChrome(event.target))
      return
    const target = targetFrom(event.target) ?? targetFromPoint(event.clientX, event.clientY)
    if (target && !selectedTargets.value.some(item => item.el === target.el))
      selection.value = target
  }, { capture: true })

  function toggleTarget(target: StudioTarget) {
    const current = selectedTargets.value.filter(item => isMultiSelectable(item, content()))
    const exists = current.some(item => item.el === target.el)
    setSelectedTargets(exists ? current.filter(item => item.el !== target.el) : [...current, target])
  }

  let boxStart: { x: number, y: number, no: number, base: StudioTarget[] } | null = null
  function startMarquee(event: PointerEvent) {
    if (busy.value) return
    event.preventDefault()
    event.stopPropagation()
    boxStart = { x: event.clientX, y: event.clientY, no: no(), base: event.shiftKey ? selectedTargets.value.filter(item => isMultiSelectable(item, content())) : [] }
  }
  onDomEvent<PointerEvent>(window, 'pointermove', event => {
    if (!boxStart) return
    if (no() !== boxStart.no) { boxStart = null; marquee.value = null; return }
    if (Math.hypot(event.clientX - boxStart.x, event.clientY - boxStart.y) < 4 && !marquee.value) return
    const left = Math.min(boxStart.x, event.clientX), top = Math.min(boxStart.y, event.clientY)
    const width = Math.abs(event.clientX - boxStart.x), height = Math.abs(event.clientY - boxStart.y)
    marquee.value = { left, top, width, height }
    const targets = mappedElements(no()).filter(isVisible).map(el => describe(el, no(), content()))
      .filter(target => isMultiSelectable(target, content()))
      .filter(target => {
        const box = target.el.getBoundingClientRect()
        return box.right >= left && box.left <= left + width && box.bottom >= top && box.top <= top + height
      })
    const all = [...boxStart.base, ...targets]
    setSelectedTargets(all.filter((target, index) => all.findIndex(item => sameRange(item.range, target.range)) === index))
    missed.value = false
  })
  const finishMarquee = () => { boxStart = null; marquee.value = null }
  onDomEvent(window, 'pointerup', finishMarquee)
  onDomEvent(window, 'pointercancel', finishMarquee)

  function selectOnPointer(event: PointerEvent, startDrag = true) {
    if (!studioOpen.value || event.button !== 0 || editing.value)
      return
    // The overlay and the handles handle themselves.
    if (isStudioChrome(event.target)) {
      if (event.shiftKey && event.target instanceof Element && event.target.closest('.studio-move')) {
        const target = throughChrome(event.clientX, event.clientY)
        if (target && isMultiSelectable(target, content())) {
          event.preventDefault(); event.stopPropagation(); toggleTarget(target)
        }
      }
      return
    }
    // A field in the dock keeps focus otherwise, and the next Backspace edits
    // that field instead of deleting the selected block.
    if (isTyping(document.activeElement))
      (document.activeElement as HTMLElement).blur()

    const target = targetFrom(event.target) ?? targetFromPoint(event.clientX, event.clientY)
    if (!target) {
      // Inside the slide but not on anything mapped: say so rather than
      // dropping the click without a word, and let go of what was selected,
      // since leaving the outline behind reads as the click not registering.
      const onSlide = event.target instanceof Element && belongsToSlide(event.target, no())
      missed.value = onSlide
      if (onSlide) {
        startMarquee(event)
        if (!event.shiftKey) selection.value = null
      }
      return
    }
    // Claim the gesture before Slidev's own `v-drag` handles or a link can.
    event.preventDefault()
    event.stopPropagation()
    missed.value = false
    if (event.shiftKey && isMultiSelectable(target, content())) {
      toggleTarget(target)
      return
    }
    if (!selectedTargets.value.some(item => item.el === target.el)) selection.value = target
    if (startDrag && !busy.value)
      startMove?.(event)
  }

  onDomEvent<PointerEvent>(document, 'pointerdown', selectOnPointer, { capture: true })

  onDomEvent<PointerEvent>(document, 'pointermove', (event) => {
    if (!studioOpen.value || editing.value)
      return
    // Over the editor's own chrome, nothing on the slide is hovered. The
    // selection overlay is the exception: it lies on top of the block it
    // belongs to, and clearing there made the outline flicker under the
    // pointer.
    if (isStudioChrome(event.target)) {
      if (!(event.target instanceof Element && event.target.closest('.studio-move')))
        hovered.value = null
      return
    }
    // Deliberately not the geometric fallback: hovering runs on every pointer
    // move, and reading computed styles for a whole slide there is enough work
    // to stall the renderer.
    hovered.value = targetFrom(event.target)
  }, { capture: true, passive: true })

  // Double click edits the text where it sits, which is what people expect of
  // anything on a canvas.
  function editOnPointer(event: MouseEvent) {
    if (!studioOpen.value || editing.value || busy.value)
      return

    // The first click of a double click selects, which lays the move overlay
    // over the block, so the second click lands on the overlay rather than on
    // the text. What is under the pointer is what was aimed at, so the overlay
    // is looked through rather than treated as the answer: double clicking a
    // nested block inside a selected container edits that block, not the
    // container.
    if (event.target instanceof Element && event.target.closest('.studio-move')) {
      const beneath = throughChrome(event.clientX, event.clientY) ?? selection.value
      if (!beneath?.range && !beneath?.prop)
        return
      event.preventDefault()
      selection.value = beneath
      if (beneath.el.dataset.studioQuestionControl !== undefined) {
        activePanel.value = 'inspect'
        inspectorVisible.value = true
      }
      else if (beneath.element !== 'image' && beneath.element !== 'shape') {
        editPointer.value = { x: event.clientX, y: event.clientY }
        editing.value = true
      }
      return
    }

    if (isStudioChrome(event.target))
      return

    const target = targetFrom(event.target) ?? targetFromPoint(event.clientX, event.clientY)
    if (!target?.range && !target?.prop)
      return
    event.preventDefault()
    selection.value = target
    if (target.el.dataset.studioQuestionControl !== undefined) {
      activePanel.value = 'inspect'
      inspectorVisible.value = true
    }
    else if (target.element !== 'image' && target.element !== 'shape') {
      editPointer.value = { x: event.clientX, y: event.clientY }
      editing.value = true
    }
  }

  onDomEvent<MouseEvent>(document, 'dblclick', editOnPointer, { capture: true })

  onDomEvent<KeyboardEvent>(document, 'keydown', (event) => {
    if (!studioOpen.value)
      return

    if (event.key === 'Escape') {
      boxStart = null
      marquee.value = null
      // One layer at a time. A key pressed in a field belongs to that field,
      // and the inline editor closes itself, so clearing the selection here as
      // well meant cancelling an edit lost the block being edited.
      //
      // Tested on the node itself rather than on its ancestors: the editor is
      // unmounted by the time this runs, and `closest` on a node that has been
      // taken out of the document finds nothing.
      if (isTyping(event.target) || isStudioChrome(event.target))
        return
      if (editing.value)
        editing.value = false
      else
        selection.value = null
      return
    }

    if (event.key !== 'Backspace' && event.key !== 'Delete')
      return
    // Never while the user is typing into one of the editor's own fields.
    if (busy.value || editing.value || isTyping(event.target) || !selection.value?.range || !remove)
      return

    // Backspace would otherwise navigate the browser back and lose the deck.
    event.preventDefault()
    const target = selection.value
    const targets = selectedTargets.value
    if (!confirmQuestionRemoval(content(), targets.length > 1 ? targets.map(item => item.range!) : [target.range!])) return
    const next = targets.length > 1 ? removePositions(content(), targets.map(item => item.range!)) : removeBlock(content(), positionedUnit(content(), target.range!))
    selection.value = null
    remove(next, action('actionDelete', { name: targetName(target) }))
  })

  watch(studioOpen, (open) => {
    if (!open) {
      finishMarquee()
      selection.value = null
      hovered.value = null
    }
  })

  const { reselect, selectInserted, selectInsertedMany, reselectTargets } = useSelectionRebind(no, content)
  onScopeDispose(finishMarquee)

  /**
   * Selects whatever is under the pointer, looking through Studio's own chrome.
   *
   * The selection overlay covers its block, so without this a click there could
   * never reach anything: not a nested block inside the selection, and not
   * another element that happens to lie underneath it.
   */
  function selectThrough(x: number, y: number) {
    const target = throughChrome(x, y)
    if (target && !selectedTargets.value.some(item => item.el === target.el))
      selection.value = target
  }

  return { select, targetFrom, reselect, reselectTargets, selectInserted, selectInsertedMany, selectThrough, selectOnPointer, editOnPointer }
}

/** Focus is in a text field, so the key belongs to that field, not the canvas. */
function isTyping(target: EventTarget | null) {
  if (!(target instanceof HTMLElement))
    return false
  return target.isContentEditable
    || ['input', 'textarea', 'select'].includes(target.tagName.toLowerCase())
}

export { describeTarget, isMultiSelectable } from '../selection-target'
