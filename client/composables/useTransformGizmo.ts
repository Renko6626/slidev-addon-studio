import { resizeShapeBox } from '../../shared/shapes'
import { action } from '../i18n'
import type { ActionLabel } from '../i18n'
import type { DragPos, StudioTarget } from '../types'
import type { Box, Guide } from './useSnapping'
import type { useSlideCanvas } from './useSlideCanvas'
import { ref, shallowRef } from 'vue'
import { mappedElements } from '../dom'
import { onDomEvent } from './useDomEvent'
import { DRAG_WRAPPER_PADDING, readDrag, writeDrag } from '../md/drag'
import { readElement } from '../md/elements'
import { movePositions } from '../md/batch'
import { boundsOf } from '../selection-geometry'
import { busy, editing, gridEnabled, gridSize, snapEnabled } from '../state'
import { snapBox } from './useSnapping'

export type ResizeHandle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w'

/**
 * How far the pointer must travel, in screen pixels, before a press counts as a
 * gesture. Below this nothing is painted and nothing is written: a click is a
 * click, and giving a block a fixed position is a decision, not a twitch.
 */
const DRAG_THRESHOLD = 4

/**
 * How far the pointer must travel before a block that is still in the document
 * flow is given a free position.
 *
 * Higher than the ordinary threshold because this one rewrites the Markdown's
 * shape rather than four numbers in it: a couple of pixels of hand drift
 * between the two clicks of a double click was enough to leave a `<v-drag>`
 * behind, on a gesture that meant "let me edit this text".
 */
const PROMOTE_THRESHOLD = 12

/** How much of an element must stay on the canvas, in canvas units. */
const MIN_ON_CANVAS = 24

type Gesture =
  | { type: 'move' }
  | { type: 'resize', handle: ResizeHandle }
  | { type: 'rotate' }

/**
 * Move, resize and rotate on the canvas.
 *
 * The gesture paints straight onto the element's inline style so it tracks the
 * pointer at screen refresh rate, and only writes Markdown once, on release.
 * Dragging a block that has no position yet gives it one, which is what turns
 * a document into a canvas, and the inspector can always send it back into
 * the flow.
 */
export function useTransformGizmo(context: {
  canvas: ReturnType<typeof useSlideCanvas>
  getTarget: () => StudioTarget | null
  getTargets?: () => StudioTarget[]
  getContent: () => string
  /** The slide being edited, so a gesture cannot land on a different one. */
  getNo: () => number
  commit: (content: string, label: ActionLabel, options?: { skipHmr?: boolean, keepSelection?: boolean }) => Promise<void>
  /** Selects what lies under a point, for a press on the overlay that was a click. */
  selectThrough: (x: number, y: number) => void
  onDoubleClick?: (event: PointerEvent) => void
}) {
  const { canvas } = context

  /** A gesture is armed on pointerdown but only becomes active once it moves. */
  const armed = ref(false)
  const active = ref(false)
  const guides = shallowRef<Guide[]>([])
  const preview = shallowRef<Box | null>(null)

  let gesture: Gesture | null = null
  let target: StudioTarget | null = null
  let startBox: Box = { x: 0, y: 0, w: 0, h: 0 }
  let hadPosition = false
  let startRotate = 0
  let originalRotate = 0
  let autoHeight = true
  let imageRatio = false
  /** The position will be written as a `<v-drag>` wrapper around the block. */
  let wrapped = false
  /** Units the written box has that the painted element does not. */
  let padding = 0
  let pointerStart = { x: 0, y: 0 }
  let others: Box[] = []
  let painted: HTMLElement | null = null
  let restore = ''
  let startNo = 0
  let press = { x: 0, y: 0 }
  let lastClick: { at: number, x: number, y: number, el: HTMLElement } | null = null

  let group: { target: StudioTarget, el: HTMLElement, style: string, pos: DragPos }[] = []
  let groupDelta = { x: 0, y: 0 }
  function clearGroup(restoreStyles = false) {
    if (restoreStyles) for (const item of group) item.el.setAttribute('style', item.style)
    group = []
    armed.value = false
    active.value = false
    guides.value = []
    preview.value = null
  }

  function start(event: PointerEvent, next: Gesture) {
    // Only the primary button drags. A right-click on the selection overlay
    // otherwise armed a gesture and swallowed the event that opens the context
    // menu, so the menu never appeared over the very thing it is about.
    if (event.button !== 0 || busy.value || editing.value)
      return

    const current = context.getTarget()
    if (!current || !current.range)
      return
    if (current.element === 'text' && readDrag(context.getContent(), current.range)?.pos?.h == null && next.type === 'resize' && !['e', 'w'].includes(next.handle))
      return

    const targets = context.getTargets?.() ?? [current]
    if (targets.length > 1) {
      lastClick = null
      if (next.type !== 'move' || event.shiftKey) return
      const content = context.getContent()
      group = targets.flatMap(target => {
        const drag = target.range && readDrag(content, target.range)
        if (!drag?.pos) return []
        const el = drag.via === 'wrapper' ? positionedWrapper(target.el) ?? target.el : target.el
        return [{ target, el, style: el.getAttribute('style') ?? '', pos: drag.pos }]
      })
      if (group.length !== targets.length) { group = []; return }
      event.preventDefault(); event.stopPropagation()
      armed.value = true
      active.value = false
      pointerStart = { x: event.clientX, y: event.clientY }
      startNo = current.no
      startBox = boundsOf(group.map(item => canvas.boxOf(item.el)))
      groupDelta = { x: 0, y: 0 }
      const elements = group.map(item => item.target.el)
      others = mappedElements(current.no).filter(el => !elements.some(selected => el === selected || el.contains(selected) || selected.contains(el))).map(el => canvas.boxOf(el))
      return
    }

    // Only a completed click on this same object can start a double click.
    // A previous drag or a press on another handle must not swallow this one.
    const now = Date.now()
    const doubleClick = next.type === 'move' && current.element !== 'image' && current.element !== 'shape'
      && lastClick?.el === current.el && now - lastClick.at < 350
      && Math.hypot(event.clientX - lastClick.x, event.clientY - lastClick.y) < 6
    lastClick = null
    press = { x: event.clientX, y: event.clientY }
    if (doubleClick) {
      // The first press hit the object, the second can hit its new overlay.
      // Browsers need not emit dblclick across those two different elements.
      context.onDoubleClick?.(event)
      return
    }

    event.preventDefault()
    event.stopPropagation()

    target = current
    gesture = next
    armed.value = true

    const existing = readDrag(context.getContent(), current.range)
    hadPosition = !!existing
    // Elements and components take the directive and are positioned directly;
    // a Markdown block gets a wrapper, whose padding sits outside it.
    wrapped = existing ? existing.via === 'wrapper' : !current.tag

    // A block that is already wrapped is moved and measured by its container,
    // whose box already includes the wrapper's own padding. A block being
    // positioned for the first time has no container yet, so it is measured as
    // it stands and the padding the wrapper will add is accounted for on write.
    const container = wrapped && hadPosition ? positionedWrapper(current.el) : null
    painted = container ?? current.el
    padding = container ? 0 : (wrapped ? DRAG_WRAPPER_PADDING : 0)

    startBox = canvas.boxOf(painted)
    startRotate = existing?.pos?.rotate ?? 0
    originalRotate = startRotate
    autoHeight = existing?.pos ? existing.pos.h === null : true
    imageRatio = readElement(context.getContent(), current.range)?.lockRatio ?? false
    pointerStart = { x: event.clientX, y: event.clientY }
    preview.value = { ...startBox }

    startNo = current.no
    others = collectOthers(current.el, current.no)
    restore = painted.getAttribute('style') ?? ''
  }

  /**
   * Detaching the element from the flow is deferred until the gesture is real.
   * Doing it on pointerdown made a plain click visibly shift the slide, because
   * the element left its parent's centring before anyone had asked for it.
   */
  function begin() {
    active.value = true
    if (painted && !hadPosition) {
      painted.style.position = 'absolute'
      painted.style.margin = '0'
    }
  }

  onDomEvent<PointerEvent>(window, 'pointermove', (event) => {
    if (group.length) {
      if (context.getNo() !== startNo) { clearGroup(true); return }
      const dx = (event.clientX - pointerStart.x) / canvas.scale.value
      const dy = (event.clientY - pointerStart.y) / canvas.scale.value
      if (!active.value && Math.hypot(event.clientX - pointerStart.x, event.clientY - pointerStart.y) < DRAG_THRESHOLD) return
      active.value = true
      let box = { ...startBox, x: startBox.x + dx, y: startBox.y + dy }
      if (snapEnabled.value && !event.altKey) {
        const result = snapBox(box, { canvas: { w: canvas.slideWidth.value, h: canvas.slideHeight.value }, others, threshold: 6 / canvas.scale.value, grid: gridEnabled.value ? gridSize.value : undefined, edges: { left: true, right: true, top: true, bottom: true } })
        box = result.box; guides.value = result.guides
      }
      else guides.value = []
      box = clampToCanvas(box)
      groupDelta = { x: box.x - startBox.x, y: box.y - startBox.y }
      for (const item of group) {
        item.el.style.left = `${item.pos.x + groupDelta.x}px`
        item.el.style.top = `${item.pos.y + groupDelta.y}px`
      }
      return
    }
    if (!armed.value || !gesture || !target)
      return

    if (!active.value) {
      const travelled = Math.hypot(event.clientX - pointerStart.x, event.clientY - pointerStart.y)
      if (travelled < (hadPosition ? DRAG_THRESHOLD : PROMOTE_THRESHOLD))
        return
      begin()
    }

    const dx = (event.clientX - pointerStart.x) / canvas.scale.value
    const dy = (event.clientY - pointerStart.y) / canvas.scale.value

    if (gesture.type === 'rotate') {
      const centreX = canvas.rect.value.left + (startBox.x + startBox.w / 2) * canvas.scale.value
      const centreY = canvas.rect.value.top + (startBox.y + startBox.h / 2) * canvas.scale.value
      const angle = Math.atan2(event.clientY - centreY, event.clientX - centreX) * 180 / Math.PI + 90
      startRotate = event.shiftKey ? Math.round(angle / 15) * 15 : Math.round(angle)
      paint(preview.value ?? startBox, startRotate)
      return
    }

    let box: Box
    let edges: { left?: boolean, right?: boolean, top?: boolean, bottom?: boolean }

    if (gesture.type === 'move') {
      box = { ...startBox, x: startBox.x + dx, y: startBox.y + dy }
      edges = { left: true, right: true, top: true, bottom: true }
    }
    else {
      // The pointer moves on screen, the box lives in the element's own frame.
      // On a rotated element those are different directions, so dragging the
      // east handle of a tilted block stretched it sideways on screen rather
      // than along its own edge.
      const angle = (-startRotate * Math.PI) / 180
      const localX = dx * Math.cos(angle) - dy * Math.sin(angle)
      const localY = dx * Math.sin(angle) + dy * Math.cos(angle)
      box = target.element === 'shape' ? resizeShapeBox(startBox, gesture.handle, localX, localY, startRotate, event.shiftKey) : resize(startBox, gesture.handle, localX, localY, target.element === 'text' ? false : target.element === 'image' ? imageRatio : event.shiftKey)
      edges = {
        left: gesture.handle.includes('w'),
        right: gesture.handle.includes('e'),
        top: gesture.handle.includes('n'),
        bottom: gesture.handle.includes('s'),
      }
    }

    if (snapEnabled.value && !event.altKey && !(imageRatio && gesture.type === 'resize') && !(target.element === 'shape' && gesture.type === 'resize' && (startRotate !== 0 || event.shiftKey))) {
      const result = snapBox(box, {
        canvas: { w: canvas.slideWidth.value, h: canvas.slideHeight.value },
        others,
        threshold: 6 / canvas.scale.value,
        grid: gridEnabled.value ? gridSize.value : undefined,
        edges,
      })
      box = result.box
      guides.value = result.guides
    }
    else {
      guides.value = []
    }

    preview.value = clampToCanvas(box)
    paint(preview.value, startRotate)
  })

  onDomEvent(window, 'pointerup', async () => {
    if (group.length) {
      const next = active.value && context.getNo() === startNo
        ? movePositions(context.getContent(), group.map(item => item.target.range!), groupDelta.x, groupDelta.y) : null
      clearGroup(next === null)
      if (next !== null) await context.commit(next, action('actionMove'), { skipHmr: true, keepSelection: true })
      return
    }
    if (!armed.value)
      return

    // A press that never moved is a click. Nothing was painted and nothing is
    // written, so selecting an element cannot silently reposition it. It is
    // also the only way to reach anything under the overlay, which covers the
    // whole selection: clicking again selects what is beneath the pointer.
    if (!active.value) {
      if (gesture?.type === 'move' && target) {
        context.selectThrough(press.x, press.y)
        lastClick = { at: Date.now(), ...press, el: target.el }
      }
      armed.value = false
      gesture = null
      preview.value = null
      target = null
      painted = null
      return
    }

    // The deck can move under a gesture: a remote, an autoplay, a stray arrow
    // key. Writing then means writing this slide's line range into whatever
    // slide is now current, so the gesture is abandoned instead.
    if (!target?.range || context.getNo() !== startNo) {
      if (painted && !hadPosition)
        painted.setAttribute('style', restore)
      armed.value = false
      active.value = false
      guides.value = []
      gesture = null
      preview.value = null
      target = null
      painted = null
      return
    }

    const box = preview.value ?? startBox
    const wasResize = gesture?.type === 'resize'
    // Only an edge that moved vertically fixes the height. A purely horizontal
    // resize used to freeze it too, writing a number the element was never
    // painted at.
    const changedHeight = gesture?.type === 'resize' && /[ns]/.test(gesture.handle)
    armed.value = false
    active.value = false
    guides.value = []
    gesture = null

    // Only when the wrapper does not exist yet does the written box need to
    // grow by the padding it will add.
    const pad = padding
    // The gesture is measured in slide coordinates because that is what the
    // overlay, the guides and the clamping all work in. What is written has to
    // be in the coordinates the block is actually positioned against, which is
    // its own containing block whenever a layout positions the panes it sits in.
    // Measured from whatever will carry the position. Once a block has one it
    // sits inside a `v-drag` wrapper, and the wrapper is then the block's own
    // offset parent, so asking the block would have subtracted the wrapper's
    // current position instead of the pane's origin, and every drag would move
    // the block by the pane's offset on top of the distance dragged.
    const origin = context.canvas.originOf(painted ?? target.el)
    const pos: DragPos = {
      x: box.x - pad - origin.x,
      y: box.y - pad - origin.y,
      w: box.w + pad * 2,
      // A resize that touched a vertical edge fixes the height; otherwise the
      // element keeps sizing itself, which is what authors usually want.
      h: autoHeight && !changedHeight ? null : box.h + pad * 2,
      rotate: startRotate,
    }

    const content = context.getContent()
    const next = writeDrag(content, target.range, pos)
    const label = wasResize ? action('actionResize') : action('actionMove')

    // An element that already had a position only changes its numbers, and the
    // paint above already shows the result. Rebuilding the slide for that is
    // what made dragging feel heavy and dropped the selection on every move, so
    // the write skips HMR and the painted style stands, exactly as Slidev's own
    // `v-drag` does. A block being positioned for the first time does need the
    // re-render, since only then does the directive take over its layout.
    const inPlace = hadPosition
    if (!inPlace && painted)
      painted.setAttribute('style', restore)
    if (!inPlace)
      painted = null

    await context.commit(next, label, { skipHmr: inPlace, keepSelection: inPlace })
    preview.value = null
    target = null
  })

  /**
   * Escape backs out of a gesture: the element returns to where it was and
   * nothing is written. Every editor offers this, and without it a drag that
   * has gone wrong can only be finished and then undone.
   */
  onDomEvent<KeyboardEvent>(window, 'keydown', (event) => {
    if (event.key !== 'Escape' || !armed.value)
      return

    event.preventDefault()
    event.stopImmediatePropagation()
    if (group.length) { clearGroup(true); return }
    if (painted && !hadPosition)
      painted.setAttribute('style', restore)
    else if (painted)
      paint(startBox, originalRotate)

    armed.value = false
    active.value = false
    guides.value = []
    gesture = null
    preview.value = null
    target = null
    painted = null
  }, { capture: true })

  onDomEvent(window, 'pointercancel', () => { if (group.length) clearGroup(true) })

  /**
   * The element Slidev positions for a wrapped block, if it is on screen.
   *
   * `<v-drag>` renders a container around the block and puts `position:
   * absolute` and the coordinates on that. Painting the block instead left the
   * slide showing the old position while the file held the new one, and
   * measuring the block instead squeezed the container to the block's width,
   * which wrapped the text onto a second line.
   */
  function positionedWrapper(el: HTMLElement): HTMLElement | null {
    let node: HTMLElement | null = el.parentElement
    for (let depth = 0; node && depth < 3; depth++) {
      if (getComputedStyle(node).position === 'absolute')
        return node
      node = node.parentElement
    }
    return null
  }

  /**
   * Keeps a sliver of the element on the canvas. An element dropped entirely
   * outside is invisible and, because the slide clips its overflow, impossible
   * to click and drag back: only undo or hand-editing would recover it.
   */
  function clampToCanvas(box: Box): Box {
    const width = canvas.slideWidth.value
    const height = canvas.slideHeight.value
    return {
      ...box,
      x: Math.min(Math.max(box.x, MIN_ON_CANVAS - box.w), width - MIN_ON_CANVAS),
      y: Math.min(Math.max(box.y, MIN_ON_CANVAS - box.h), height - MIN_ON_CANVAS),
    }
  }

  function paint(box: Box, rotate: number) {
    // A rebuild can land in the middle of a gesture, from an autosave or from
    // the author editing the file in their editor. The painted node is then
    // detached and the element stops following the pointer, so it is picked up
    // again from the live selection.
    if (painted && !document.contains(painted)) {
      const current = context.getTarget()
      const live = current && (wrapped ? positionedWrapper(current.el) ?? current.el : current.el)
      painted = live && document.contains(live) ? live : null
      if (painted)
        restore = painted.getAttribute('style') ?? ''
    }

    if (!painted)
      return

    // The box is in slide coordinates, which is what the gesture, the guides
    // and the snapping all work in. What is painted has to be in the
    // coordinates the element is actually positioned against. Inside a layout
    // that positions its own panes those differ, and painting the slide figure
    // put the block a pane's width to the left of the pointer, where it stayed
    // until a reload rendered it from the Markdown at the place it really was.
    const origin = canvas.originOf(painted)
    painted.style.left = `${box.x - origin.x}px`
    painted.style.top = `${box.y - origin.y}px`
    painted.style.width = `${box.w}px`
    if (!autoHeight)
      painted.style.height = `${box.h}px`
    painted.style.transform = rotate ? `rotate(${rotate}deg)` : ''
    painted.style.transformOrigin = 'center center'
  }

  function collectOthers(self: HTMLElement, no: number): Box[] {
    return mappedElements(no)
      .filter(el => el !== self && !el.contains(self) && !self.contains(el))
      .map(el => canvas.boxOf(el))
  }

  return {
    active,
    armed,
    guides,
    preview,
    startMove: (event: PointerEvent) => start(event, { type: 'move' }),
    startResize: (event: PointerEvent, handle: ResizeHandle) => start(event, { type: 'resize', handle }),
    startRotate: (event: PointerEvent) => start(event, { type: 'rotate' }),
  }
}

/** Smallest an element may be dragged to, in canvas units. */
const MIN_SIZE = 16

/**
 * Resizes a box by one of its handles.
 *
 * The edge opposite the handle is an anchor: it must not move, whatever happens
 * to the size. Setting the position from the raw pointer delta and clamping the
 * size afterwards broke that, so dragging a west or north handle past the
 * minimum, or holding Shift to keep the ratio, slid the element sideways
 * instead of resizing it in place.
 */
export function resize(box: Box, handle: ResizeHandle, dx: number, dy: number, keepRatio: boolean): Box {
  const right = box.x + box.w
  const bottom = box.y + box.h

  let w = box.w
  let h = box.h
  if (handle.includes('e'))
    w = box.w + dx
  if (handle.includes('w'))
    w = box.w - dx
  if (handle.includes('s'))
    h = box.h + dy
  if (handle.includes('n'))
    h = box.h - dy

  if (keepRatio && box.w > 0 && box.h > 0) {
    const ratio = box.w / box.h
    if (handle === 'n' || handle === 's')
      w = h * ratio
    else
      h = w / ratio
  }

  if (keepRatio && box.w > 0 && box.h > 0) {
    const ratio = box.w / box.h
    w = Math.max(MIN_SIZE, MIN_SIZE * ratio, w)
    h = w / ratio
  }
  else {
    w = Math.max(MIN_SIZE, w)
    h = Math.max(MIN_SIZE, h)
  }

  return {
    x: handle.includes('w') ? right - w : box.x,
    y: handle.includes('n') ? bottom - h : box.y,
    w,
    h,
  }
}
