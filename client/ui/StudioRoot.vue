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
import { studioContext, studioKey } from '../context'
import { busy, dockWidth, editing, inspectorVisible, lastError, notesVisible, selection, slidesVisible, studioOpen } from '../state'
import { fitSlide } from '../editor-view'
import { t } from '../i18n'
import { useEditorMode } from '../composables/useEditorMode'
import InlineEditor from './InlineEditor.vue'
import SelectionLayer from './SelectionLayer.vue'
import StudioDock from './StudioDock.vue'
import StudioToolbar from './StudioToolbar.vue'
import PanelSlides from './panels/PanelSlides.vue'
import StudioLibrary from './StudioLibrary.vue'
import StudioNotes from './StudioNotes.vue'
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
const no = computed(() => nav.currentSlideNo.value)

const source = useSlideSource(no)
const canvas = useSlideCanvas(() => Number(source.frontmatter.value.zoom ?? 1))
async function commit(content: string, label: ActionLabel, options?: { skipHmr?: boolean, keepSelection?: boolean }) {
  const current = selection.value
  await source.setContent(content, label, options)

  // Nothing re-rendered, so the element the user is holding is still the one on
  // screen. Re-finding it would only make the panel flicker.
  if (options?.keepSelection || !current)
    return

  await selectionApi.reselect(current.range, current.kind, current.tag)
}

const selectionApi = useSelection(
  () => no.value,
  () => source.content.value,
  // Deleting drops the selection outright, so there is nothing to restore.
  (next, label) => source.setContent(next, label),
)

const gizmo = useTransformGizmo({
  canvas,
  getTarget: () => selection.value,
  getContent: () => source.content.value,
  getNo: () => no.value,
  commit,
  selectThrough: (x, y) => selectionApi.selectThrough(x, y),
})

const context: StudioContext = {
  no: () => no.value,
  content: () => source.content.value,
  frontmatter: () => source.frontmatter.value,
  note: () => source.note.value,
  canvas,
  gizmo,
  commit,
  setFrontmatter: (values, label) => source.setFrontmatter(values, label),
  setNote: note => source.setNote(note),
  range: () => selection.value?.range ?? null,
  selectInserted: (tag, range) => selectionApi.selectInserted(tag, range),
  selectThrough: (x, y) => selectionApi.selectThrough(x, y),
  go: target => nav.go(target),
}

provide(studioKey, context)

// Also outside the component tree, for Slidev's setup files: the context menu
// is built there and has no way to inject.
studioContext.value = context
onScopeDispose(() => (studioContext.value = null))

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
  if (!studioOpen.value || editing.value)
    return
  const target = selection.value
  if (!target?.range)
    return
  // A key pressed in a panel field belongs to that field.
  if (event.target instanceof Element && event.target.closest('input, textarea, [contenteditable="true"]'))
    return

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

// `useDynamicSlideInfo` fetches the slide source lazily, on first read. Touch
// it here so the source is already in hand when the user clicks, rather than
// the first click of every slide being the one that starts the request.
watchEffect(() => void source.info.value)

const mode = useEditorMode()
const viewport = useWindowSize()
const stage = ref<HTMLElement | null>(null)
const bounds = useElementBounding(stage)
const fitted = computed(() => fitSlide({ left: bounds.left.value, top: bounds.top.value, width: bounds.width.value, height: bounds.height.value }, { width: slideWidth.value, height: slideHeight.value }))
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
      <template v-if="studioOpen">
        <div class="studio-backdrop" />
        <div class="studio-workspace" :style="shellStyle">
          <StudioToolbar @preview="mode.preview" @present="mode.present" @fit="bounds.update()" />
          <aside v-if="slidesVisible" class="studio-navigation"><PanelSlides /></aside>
          <main class="studio-center">
            <div ref="stage" class="studio-stage" />
            <StudioNotes v-if="notesVisible" :key="no" />
          </main>
          <StudioDock v-if="inspectorVisible" />
          <footer class="studio-statusbar">
            <span>{{ t('pageProgress', { current: no, total: nav.total.value }) }}</span>
            <span v-if="busy" role="status">{{ t('writing') }}</span>
            <span v-if="editing" class="studio-statusbar__editing">{{ t('finishEditing') }}</span>
            <span class="studio-statusbar__spacer" />
            <button :aria-pressed="notesVisible" @click="notesVisible = !notesVisible">{{ t('presenterNotes') }}</button>
            <span>{{ Math.round(fitted.scale * 100) }}%</span>
            <button class="studio-statusbar__fit" @click="bounds.update()"><StudioIcon name="fit" :size="14" />{{ t('fitWindow') }}</button>
          </footer>
        </div>
        <SelectionLayer />
        <InlineEditor />
        <StudioLibrary />
      </template>
      <button v-else-if="mode.previewing.value && !mode.isFullscreen.value" class="studio-return" @click="mode.returnToEditor">
        <StudioIcon name="edit" />{{ t('returnEditor') }}
      </button>
      <div v-if="lastError" class="studio-toast" role="alert">{{ lastError }}</div>
    </div>
  </Teleport>
</template>
