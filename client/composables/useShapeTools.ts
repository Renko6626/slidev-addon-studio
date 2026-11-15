import { computed, onScopeDispose, ref, shallowRef, watch } from 'vue'
import type { StudioContext } from '../context'
import type { StudioTarget } from '../types'
import { action } from '../i18n'
import { activePanel, busy, editing, inspectorVisible, library, reportError, ribbonTab, selection, studioOpen } from '../state'
import { appendElement } from '../md/elements'
import { createShape, patchShape, readShape } from '../md/shapes'
import { readDrag, writeDrag } from '../md/drag'
import { adjustShape, lineEndpoints, lineFromPoints, localPoint, presetShape } from '../../shared/shapes'
import type { Point, ShapeBox, ShapeHandle, ShapeOptions, ShapePreset } from '../../shared/shapes'
import { onDomEvent } from './useDomEvent'

type Host = Pick<StudioContext, 'canvas' | 'no' | 'content' | 'commit' | 'sourceReady' | 'selectInserted'>
export function useShapeTools(studio: Host) {
  const drawing = ref<ShapePreset | null>(null)
  const drawnBox = shallowRef<ShapeBox | null>(null)
  const adjustment = shallowRef<Partial<ShapeOptions> | null>(null)
  const adjusting = ref(false)
  const parameters = computed(() => {
    const target = selection.value
    const source = target?.range ? readShape(studio.content(), target.range) : null
    return source ? { ...source, ...adjustment.value } : null
  })
  let anchor: Point | null = null
  let page = 0
  let handle: ShapeHandle | null = null
  let target: StudioTarget | null = null
  let original: ShapeOptions | null = null
  let box: ShapeBox | null = null
  let nextBox: ShapeBox | null = null
  let originalStyle = ''

  function cancel(restorePreview = true) {
    if (target && restorePreview) {
      target.el.setAttribute('style', originalStyle)
      target.el.dispatchEvent(new CustomEvent('studio-shape-preview', { detail: null }))
    }
    drawing.value = null
    drawnBox.value = null
    adjustment.value = null
    adjusting.value = false
    anchor = null
    handle = null
    target = null
    original = null
    box = null
    nextBox = null
  }
  function choose(preset: ShapePreset) {
    if (busy.value || editing.value || !studio.sourceReady()) return
    cancel()
    selection.value = null
    library.value = null
    drawing.value = preset
    page = studio.no()
  }
  function beginDraw(event: PointerEvent) {
    if (event.button !== 0 || !drawing.value || busy.value) return
    event.preventDefault()
    event.stopPropagation()
    anchor = studio.canvas.toCanvas(event.clientX, event.clientY)
  }
  function startHandle(event: PointerEvent, id: ShapeHandle) {
    const selected = selection.value
    if (event.button !== 0 || busy.value || editing.value || !selected?.range || !parameters.value) return
    const pos = readDrag(studio.content(), selected.range)?.pos
    if (!pos) return
    event.preventDefault()
    event.stopPropagation()
    target = selected
    original = { ...parameters.value }
    box = { ...studio.canvas.boxOf(selected.el), rotate: pos.rotate }
    originalStyle = selected.el.getAttribute('style') ?? ''
    page = studio.no()
    handle = id
    adjusting.value = true
  }
  function paintPosition(next: ShapeBox) {
    if (!target) return
    const origin = studio.canvas.originOf(target.el)
    Object.assign(target.el.style, { left: `${next.x - origin.x}px`, top: `${next.y - origin.y}px`, width: `${next.w}px`, height: `${next.h}px`, transform: `rotate(${next.rotate}deg)`, transformOrigin: 'center center' })
  }
  onDomEvent<PointerEvent>(window, 'pointermove', event => {
    if (!anchor && !handle) return
    const p = studio.canvas.toCanvas(event.clientX, event.clientY)
    if (drawing.value && anchor) {
      if (Math.hypot(p.x - anchor.x, p.y - anchor.y) * studio.canvas.scale.value < 4) return
      if (presetShape(drawing.value).kind === 'line') drawnBox.value = lineFromPoints(anchor, p, event.shiftKey)
      else {
        let dx = p.x - anchor.x, dy = p.y - anchor.y
        if (event.shiftKey) { const side = Math.max(Math.abs(dx), Math.abs(dy)); dx = Math.sign(dx || 1) * side; dy = Math.sign(dy || 1) * side }
        drawnBox.value = { x: anchor.x + Math.min(0, dx), y: anchor.y + Math.min(0, dy), w: Math.max(16, Math.abs(dx)), h: Math.max(16, Math.abs(dy)), rotate: 0 }
      }
    }
    else if (handle && target && box && original) {
      if (handle === 'start' || handle === 'end') {
        const [start, end] = lineEndpoints(box)
        if (handle === 'end') nextBox = lineFromPoints(start, p, event.shiftKey)
        else {
          // Snap around the fixed end, then reverse the resulting endpoints.
          const reversed = lineFromPoints(end, p, event.shiftKey)
          const [, moved] = lineEndpoints(reversed)
          nextBox = lineFromPoints(moved, end)
        }
        paintPosition(nextBox)
      }
      else {
        adjustment.value = adjustShape(original, handle, localPoint(p, box), box.w, box.h)
        target.el.dispatchEvent(new CustomEvent('studio-shape-preview', { detail: adjustment.value }))
      }
    }
  })
  async function finish() {
    if (studio.no() !== page || !studioOpen.value) { cancel(); return }
    if (drawing.value && anchor) {
      const preset = drawing.value
      const insertedBox = drawnBox.value ?? { x: anchor.x, y: anchor.y, w: 240, h: presetShape(preset).kind === 'line' ? 16 : 160, rotate: 0 }
      const inserted = appendElement(studio.content(), createShape(preset, insertedBox))
      const no = page
      cancel()
      await studio.commit(inserted.content, action('actionInsert', { name: { key: 'shape' } }))
      if (studio.no() === no && await studio.selectInserted('StudioShape', inserted.range)) {
        activePanel.value = 'inspect'
        inspectorVisible.value = true
      }
    }
    else if (handle && target?.range) {
      const held = target
      let next = studio.content()
      if (nextBox) {
        const origin = studio.canvas.originOf(held.el)
        next = writeDrag(next, held.range!, { ...nextBox, x: nextBox.x - origin.x, y: nextBox.y - origin.y })
      }
      else if (adjustment.value) next = patchShape(next, held.range!, adjustment.value)
      // Keep the last preview visible until the source render takes over.
      if (next !== studio.content()) {
        try { await studio.commit(next, action('actionElementFormat')); cancel(false) }
        catch (error) { cancel(); throw error }
      }
      else cancel()
    }
  }
  onDomEvent(window, 'pointerup', () => { if (anchor || handle) void finish().catch(reportError) })
  onDomEvent(window, 'pointercancel', () => cancel())
  onDomEvent<KeyboardEvent>(window, 'keydown', event => {
    if (event.key === 'Escape' && (drawing.value || handle)) {
      event.preventDefault()
      event.stopImmediatePropagation()
      cancel()
    }
  }, { capture: true })
  watch(() => [studio.no(), studioOpen.value, ribbonTab.value === 'file'], () => {
    if (studio.no() !== page || !studioOpen.value || ribbonTab.value === 'file') cancel()
  })
  onScopeDispose(() => cancel())
  async function set(patch: Partial<ShapeOptions>) {
    if (!selection.value?.range || busy.value || editing.value || adjusting.value) return
    await studio.commit(patchShape(studio.content(), selection.value.range, patch), action('actionElementFormat'))
  }
  return { drawing, drawnBox, parameters, adjusting, choose, beginDraw, startHandle, cancel, set }
}
