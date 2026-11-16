<script setup lang="ts">
import type { ActionLabel } from '../i18n'
import type { StudioContext } from '../context'
import { useNav } from '@slidev/client'
import { useElementBounding, useWindowSize } from '@vueuse/core'
import { slideWidth, slideHeight } from '@slidev/client/env.ts'
import { computed, onScopeDispose, provide, ref, watch, watchEffect } from 'vue'
import { duplicateBlock, nudgeBlock } from '../actions'
import { onDomEvent } from '../composables/useDomEvent'
import { useSelection } from '../composables/useSelection'
import { useSlideCanvas } from '../composables/useSlideCanvas'
import { useSlideSource } from '../composables/useSlideSource'
import { useTransformGizmo } from '../composables/useTransformGizmo'
import { useTextEditor } from '../composables/useTextEditor'
import { studioContext, studioKey } from '../context'
import { activePanel, busy, dockWidth, editing, inspectorVisible, lastError, notesVisible, ribbonTab, selection, selectedTargets, slidesVisible, studioOpen } from '../state'
import { imagePending } from '../composables/useImageInsertion'
import { projectSaveStatus, projectWriteError, saveProject } from '../project-save'
import { projectHost } from '../project-host'
import { fitSlide, placeSlide } from '../editor-view'
import { t } from '../i18n'
import { useEditorMode } from '../composables/useEditorMode'
import { useObjectClipboard } from '../composables/useObjectClipboard'
import { useShapeTools } from '../composables/useShapeTools'
import ShapeDrawingLayer from './ShapeDrawingLayer.vue'
import InlineEditor from './InlineEditor.vue'
import SelectionLayer from './SelectionLayer.vue'
import QuestionRelations from './QuestionRelations.vue'
import StudioDock from './StudioDock.vue'
import StudioToolbar from './StudioToolbar.vue'
import PanelSlides from './panels/PanelSlides.vue'
import StudioLibrary from './StudioLibrary.vue'
import StudioNotes from './StudioNotes.vue'
import StudioFile from './StudioFile.vue'
import StudioIcon from './parts/StudioIcon.vue'
import '../../styles/studio.css'

/**
 * The editor shell.
 *
 * Mounted from `global-top.vue`, which means it lives outside the slide's own
 * component tree: it can watch and rewrite the deck without any of its state
 * ending up in an exported slide.
 */
const nav = useNav()
const desktop = !!projectHost()
const no = computed(() => nav.currentSlideNo.value)

const source = useSlideSource(no)
const inlineEditor = ref<InstanceType<typeof InlineEditor> | null>(null)
const notesEditor = ref<InstanceType<typeof StudioNotes> | null>(null)
async function save() {
  if (imagePending.value) return false
  return saveProject(async () => {
    await inlineEditor.value?.apply()
    if (editing.value) throw new Error(t('finishEditing'))
    await notesEditor.value?.apply()
  })
}
const canvas = useSlideCanvas(() => Number(source.frontmatter.value.zoom ?? 1))
async function commit(content: string, label: ActionLabel, options?: { skipHmr?: boolean, keepSelection?: boolean }) {
  const current = selection.value
  const targets = selectedTargets.value
  await source.setContent(content, label, options)

  // Nothing re-rendered, so the element the user is holding is still the one on
  // screen. Re-finding it would only make the panel flicker.
  if (options?.keepSelection || !current || selection.value !== current)
    return

  if (targets.length > 1) await selectionApi.reselectTargets(targets)
  else await selectionApi.reselect(current.range, current.kind, current.tag)
}

const selectionApi = useSelection(
  () => no.value,
  () => source.content.value,
  // Deleting drops the selection outright, so there is nothing to restore.
  (next, label) => source.setContent(next, label),
  event => gizmo.startMove(event),
)

const gizmo = useTransformGizmo({
  canvas,
  getTarget: () => selection.value,
  getTargets: () => selectedTargets.value,
  getContent: () => source.content.value,
  getNo: () => no.value,
  commit,
  selectThrough: (x, y) => selectionApi.selectThrough(x, y),
  onDoubleClick: event => selectionApi.editOnPointer(event),
})

const context: StudioContext = {
  no: () => no.value,
  content: () => source.content.value,
  sourceReady: () => source.info.value != null,
  frontmatter: () => source.frontmatter.value,
  note: () => source.note.value,
  canvas,
  gizmo,
  shapes: useShapeTools({ canvas, no: () => no.value, content: () => source.content.value, sourceReady: () => source.info.value != null, commit, selectInserted: (tag, range) => selectionApi.selectInserted(tag, range) }),
  text: useTextEditor({ content: () => source.content.value, commit, selectInserted: (tag, range) => selectionApi.selectInserted(tag, range) }),
  commit,
  setFrontmatter: (values, label) => source.setFrontmatter(values, label),
  setNote: note => source.setNote(note),
  save,
  range: () => selection.value?.range ?? null,
  selectInserted: (tag, range) => selectionApi.selectInserted(tag, range),
  selectInsertedMany: items => selectionApi.selectInsertedMany(items),
  selectThrough: (x, y) => selectionApi.selectThrough(x, y),
  selectOnPointer: selectionApi.selectOnPointer,
  go: target => nav.go(target),
}

provide(studioKey, context)
useObjectClipboard(context)

// Also outside the component tree, for Slidev's setup files: the context menu
// is built there and has no way to inject.
studioContext.value = context
onScopeDispose(() => (studioContext.value = null))
// The desktop main process requests saving before changing projects or closing.
const projectBridge = { save }
window.__studioProject = projectBridge
onScopeDispose(() => { if (window.__studioProject === projectBridge) delete window.__studioProject })

/*
 * The keys a canvas is expected to answer to.
 *
 * Slidev owns the arrows for navigation and Studio has no business taking them
 * from a deck being presented. It takes them only when it has a positioned
 * block selected and nobody is typing, which is the one case where an arrow
 * plainly means "move this a bit", and hands them straight back otherwise.
 *
 * A tenth of the grid on its own, the whole step with Shift, matching what the
 * gizmo snaps to.
 */
const NUDGE = 1
const NUDGE_FAR = 10

onDomEvent<KeyboardEvent>(document, 'keydown', (event) => {
  if (!studioOpen.value)
    return
  if ((event.ctrlKey || event.metaKey) && !event.altKey && event.key.toLowerCase() === 's') {
    event.preventDefault()
    event.stopImmediatePropagation()
    void save()
    return
  }
  if (ribbonTab.value === 'file') {
    // Keep native File-page scrolling/tree activation, but do not let the
    // event reach Slidev's window-level navigation and presentation shortcuts.
    event.stopImmediatePropagation()
    if (event.key === 'Escape') { event.preventDefault(); ribbonTab.value = 'home' }
    return
  }
  if (editing.value || busy.value) return
  const target = selection.value
  if (!target?.range)
    return
  // A key pressed in a panel field belongs to that field.
  if (event.target instanceof Element && event.target.closest('input, textarea, select, [contenteditable="true"]'))
    return

  if (selectedTargets.value.length === 1 && event.key === 'F2' && target.element !== 'image' && target.element !== 'shape' && !target.el.hasAttribute('data-studio-question-control') && !busy.value) {
    event.preventDefault()
    editing.value = true
    return
  }

  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'd') {
    event.preventDefault()
    duplicateBlock(context, target)
    return
  }

  const step = event.shiftKey ? NUDGE_FAR : NUDGE
  const by: Record<string, [number, number]> = {
    ArrowLeft: [-step, 0],
    ArrowRight: [step, 0],
    ArrowUp: [0, -step],
    ArrowDown: [0, step],
  }
  const delta = by[event.key]
  if (!delta || event.metaKey || event.ctrlKey || event.altKey)
    return

  // Decided here and not after the write: `preventDefault` has to happen while
  // the event is still being dispatched, and by the time an await came back
  // Slidev would already have changed slide.
  if (!target.positioned)
    return

  event.preventDefault()
  nudgeBlock(context, target, delta[0], delta[1])
}, { capture: true })

// Selection belongs to one slide; navigating away drops it.
watch(no, () => (selection.value = null))
watch(selection, target => {
  if (target?.el.hasAttribute('data-studio-question-control')) {
    activePanel.value = 'inspect'
    inspectorVisible.value = true
  }
})

// `useDynamicSlideInfo` fetches the slide source lazily, on first read. Touch
// it here so the source is already in hand when the user clicks, rather than
// the first click of every slide being the one that starts the request.
watchEffect(() => void source.info.value)

const mode = useEditorMode()
const viewport = useWindowSize()
const stage = ref<HTMLElement | null>(null)
const bounds = useElementBounding(stage)
const zoom = ref<number | null>(null)
const pan = ref({ x: 0, y: 0 })
const area = computed(() => ({ left: bounds.left.value, top: bounds.top.value, width: bounds.width.value, height: bounds.height.value }))
const slideSize = computed(() => ({ width: slideWidth.value, height: slideHeight.value }))
const fitted = computed(() => zoom.value === null ? fitSlide(area.value, slideSize.value) : placeSlide(area.value, slideSize.value, zoom.value, pan.value))
function fitView() {
  zoom.value = null
  pan.value = { x: 0, y: 0 }
  bounds.update()
}
function setZoom(value: number, anchor = { x: area.value.left + area.value.width / 2, y: area.value.top + area.value.height / 2 }) {
  if (!Number.isFinite(value) || editing.value) return
  const scale = Math.max(0.25, Math.min(3, value))
  const previous = fitted.value
  const next = placeSlide(area.value, slideSize.value, scale)
  const ratio = previous.scale ? scale / previous.scale : 1
  pan.value = { x: anchor.x - (anchor.x - previous.left) * ratio - next.left, y: anchor.y - (anchor.y - previous.top) * ratio - next.top }
  zoom.value = scale
}
function overCanvas(event: MouseEvent) {
  if (!studioOpen.value || ribbonTab.value === 'file' || editing.value) return false
  if (event.target instanceof Element && event.target.closest('.studio-library, input, textarea, select, [contenteditable="true"]')) return false
  return event.clientX >= bounds.left.value && event.clientX < bounds.right.value
    && event.clientY >= bounds.top.value && event.clientY < bounds.bottom.value
}
onDomEvent<WheelEvent>(document, 'wheel', event => {
  if (!overCanvas(event)) return
  if (event.ctrlKey || event.metaKey) {
    event.preventDefault()
    event.stopImmediatePropagation()
    setZoom(fitted.value.scale * Math.exp(-event.deltaY * 0.002), { x: event.clientX, y: event.clientY })
  }
  else if (zoom.value !== null) {
    event.preventDefault()
    event.stopImmediatePropagation()
    const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? area.value.height : 1
    pan.value = { x: pan.value.x - (event.shiftKey ? event.deltaY : event.deltaX) * unit, y: pan.value.y - (event.shiftKey ? 0 : event.deltaY) * unit }
  }
}, { capture: true, passive: false })
let panStart: { x: number, y: number, offset: { x: number, y: number } } | null = null
onDomEvent<PointerEvent>(document, 'pointerdown', event => {
  if (event.button !== 1 || !overCanvas(event)) return
  event.preventDefault()
  event.stopImmediatePropagation()
  zoom.value ??= fitted.value.scale
  panStart = { x: event.clientX, y: event.clientY, offset: { ...pan.value } }
}, { capture: true })
onDomEvent<PointerEvent>(document, 'pointermove', event => {
  if (!panStart) return
  event.preventDefault()
  event.stopImmediatePropagation()
  pan.value = { x: panStart.offset.x + event.clientX - panStart.x, y: panStart.offset.y + event.clientY - panStart.y }
}, { capture: true })
onDomEvent(document, 'pointerup', () => { panStart = null })
onDomEvent(document, 'pointercancel', () => { panStart = null })
onDomEvent(window, 'blur', () => { panStart = null })
const shellStyle = computed(() => ({
  '--studio-left-width': slidesVisible.value && viewport.width.value >= 700 ? '224px' : '0px',
  '--studio-right-width': inspectorVisible.value && viewport.width.value >= 1000 ? `${dockWidth.value}px` : '0px',
}))
watch(() => viewport.width.value < 1000, narrow => { if (narrow) inspectorVisible.value = false }, { immediate: true })
watch(() => viewport.width.value < 700, narrow => { if (narrow) slidesVisible.value = false }, { immediate: true })

const viewProperties = ['left', 'top', 'width', 'height'] as const
function resetView() {
  document.documentElement.classList.remove('slidev-studio-docked')
  for (const key of viewProperties)
    document.documentElement.style.removeProperty(`--studio-page-${key}`)
}
watchEffect(() => {
  if (!studioOpen.value) {
    resetView()
    return
  }
  document.documentElement.classList.add('slidev-studio-docked')
  for (const key of viewProperties)
    document.documentElement.style.setProperty(`--studio-page-${key}`, `${fitted.value[key]}px`)
})
onScopeDispose(resetView)

</script>

<template>
  <Teleport to="body">
    <div class="slidev-studio">
      <div v-if="desktop && !studioOpen && !mode.isFullscreen.value" class="studio-desktop-preview-titlebar">
        <div class="studio-titlebar studio-titlebar--desktop">Slidev Studio</div>
      </div>
      <template v-if="studioOpen">
        <div class="studio-backdrop" />
        <div class="studio-workspace" :style="shellStyle">
          <StudioToolbar @preview="mode.preview" @present="mode.present" @fit="fitView" />
          <StudioFile v-if="ribbonTab === 'file'" />
          <aside v-if="slidesVisible" v-show="ribbonTab !== 'file'" class="studio-navigation"><PanelSlides /></aside>
          <main v-show="ribbonTab !== 'file'" class="studio-center">
            <div ref="stage" class="studio-stage" />
            <StudioNotes v-if="notesVisible" :key="no" ref="notesEditor" />
          </main>
          <StudioDock v-if="inspectorVisible" v-show="ribbonTab !== 'file'" />
          <footer class="studio-statusbar">
            <span>{{ t('pageProgress', { current: no, total: nav.total.value }) }}</span>
            <span role="status" :class="{ 'studio-file-error': projectWriteError }">{{ t(projectSaveStatus(editing || !!notesEditor?.dirty)) }}</span>
            <span class="studio-statusbar__spacer" />
            <button :aria-pressed="notesVisible" @click="notesVisible = !notesVisible">{{ t('presenterNotes') }}</button>
            <div class="studio-zoom" :title="t('canvasNavigationHint')">
              <button :disabled="editing || fitted.scale <= 0.25" :title="t('zoomOut')" :aria-label="t('zoomOut')" @click="setZoom(fitted.scale - 0.1)">−</button>
              <label><input type="number" min="25" max="300" step="10" :disabled="editing" :aria-label="t('viewZoom')" :value="Math.round(fitted.scale * 100)" @change="setZoom(Number(($event.target as HTMLInputElement).value) / 100)">%</label>
              <button :disabled="editing || fitted.scale >= 3" :title="t('zoomIn')" :aria-label="t('zoomIn')" @click="setZoom(fitted.scale + 0.1)">+</button>
            </div>
            <button class="studio-statusbar__fit" :disabled="editing" :aria-pressed="zoom === null" @click="fitView"><StudioIcon name="fit" :size="14" />{{ t('fitWindow') }}</button>
          </footer>
        </div>
        <QuestionRelations v-if="ribbonTab !== 'file'" />
        <SelectionLayer v-if="ribbonTab !== 'file'" />
        <ShapeDrawingLayer v-if="ribbonTab !== 'file'" :viewport="area" />
        <InlineEditor ref="inlineEditor" />
        <StudioLibrary v-if="ribbonTab !== 'file'" />
      </template>
      <button v-else-if="mode.previewing.value && !mode.isFullscreen.value" class="studio-return" @click="mode.returnToEditor">
        <StudioIcon name="edit" />{{ t('returnEditor') }}
      </button>
      <div v-if="lastError" class="studio-toast" role="alert">{{ lastError }}</div>
    </div>
  </Teleport>
</template>
