<script setup lang="ts">
import type { MessageKey } from '../i18n'
import type { PanelId, RibbonTab } from '../state'
import { computed, watch } from 'vue'
import { configs } from '@slidev/client/env.ts'
import { useNav } from '@slidev/client'
import { action, actionText, studioLocale, t } from '../i18n'
import { canReorder, deleteBlock, duplicateBlock, editText, freePosition } from '../actions'
import { useStudio } from '../context'
import { useDeckActions } from '../composables/useDeckActions'
import { projectSaving } from '../project-save'
import { canRedo, canUndo, lastAction, useStudioHistory } from '../composables/useSlideSource'
import { appendElement, createTextElement, patchElementStyle } from '../md/elements'
import { imageLibraryRequest, imagePending, useImageInsertion } from '../composables/useImageInsertion'
import ShapePicker from './parts/ShapePicker.vue'
import TextElementFields from './parts/TextElementFields.vue'
import { activePanel, busy, clearSelection, editing, gridEnabled, inspectorVisible, library, notesVisible, outlineEnabled, ribbonTab, selectAllOnEdit, selection, slidesVisible, snapEnabled, studioOpen } from '../state'
import PanelTransition from './panels/PanelTransition.vue'
import StudioIcon from './parts/StudioIcon.vue'

const emit = defineEmits<{ preview: [], present: [], fit: [] }>()
const studio = useStudio()
const nav = useNav()
const deck = useDeckActions()
const images = useImageInsertion()
const history = useStudioHistory()
const textActive = computed(() => !!studio.text.editor.value)
const undoEnabled = computed(() => textActive.value ? studio.text.canUndo.value : canUndo.value && !locked.value)
const redoEnabled = computed(() => textActive.value ? studio.text.canRedo.value : canRedo.value && !locked.value)
function undo() { return textActive.value ? studio.text.undo() : history.undo() }
function redo() { return textActive.value ? studio.text.redo() : history.redo() }
const title = computed(() => configs.title || configs.slidesTitle || 'Slidev Studio')
const locked = computed(() => busy.value || editing.value || imagePending.value)
const mapped = computed(() => !!selection.value?.range)
const reorderable = computed(() => !!selection.value?.range && canReorder(selection.value))
const tabs: { id: RibbonTab, label: MessageKey }[] = [
  { id: 'home', label: 'homeTab' }, { id: 'insert', label: 'insertTab' },
  { id: 'design', label: 'designTab' }, { id: 'transition', label: 'transitionsTab' },
  { id: 'animate', label: 'animate' }, { id: 'view', label: 'viewTab' },
]
async function openFile() {
  if (ribbonTab.value === 'file') { ribbonTab.value = 'home'; return }
  if (imagePending.value || projectSaving.value) return
  await studio.save()
  if (editing.value) return
  clearSelection()
  library.value = null
  ribbonTab.value = 'file'
}
watch(selection, value => {
  if (!value && ribbonTab.value === 'object')
    ribbonTab.value = 'home'
})
watch(editing, value => {
  if (value && studio.text.supported.value)
    ribbonTab.value = 'home'
})
function panel(id: PanelId) {
  activePanel.value = id
  inspectorVisible.value = true
  library.value = null
}
function openLibrary(id: 'components' | 'assets' | 'pagePresets') {
  imageLibraryRequest.value = null
  library.value = library.value === id ? null : id
}
async function insertTextBox(heading = false) {
  if (locked.value) return
  const no = studio.no()
  let snippet = createTextElement({ width: studio.canvas.slideWidth.value, height: studio.canvas.slideHeight.value }, t(heading ? 'presetTitleText' : 'textBoxPlaceholder'))
  if (heading) snippet = patchElementStyle(snippet, [0, 1], { 'font-size': '40px' })
  const inserted = appendElement(studio.content(), snippet)
  await studio.commit(inserted.content, action('actionInsert', { name: { key: heading ? 'blockHeading' : 'textBox' } }))
  if (studio.no() !== no || !await studio.selectInserted('div', inserted.range)) return
  panel('inspect')
  selectAllOnEdit.value = true
  editing.value = true
}
interface Command { label: MessageKey, icon: string, run: () => unknown, disabled?: boolean, pressed?: boolean, hint?: MessageKey }
interface Group { label: MessageKey, commands: Command[], text?: 'font' | 'paragraph' }
const groups = computed<Group[]>(() => {
  const target = selection.value
  switch (ribbonTab.value) {
    case 'file': return []
    case 'home': return [
      { label: 'slides', commands: [
        { label: 'newSlide', icon: 'plus', run: () => openLibrary('pagePresets'), pressed: library.value === 'pagePresets', hint: 'pagePresetsHint' },
        { label: 'duplicateSlide', icon: 'copy', run: () => deck.duplicate(studio.no()), hint: 'deckReloadHint' },
        { label: 'deleteSlide', icon: 'trash', run: () => deck.remove(studio.no()), disabled: studio.no() === 1, hint: studio.no() === 1 ? 'firstSlideProtected' : 'deckReloadHint' },
      ] },
      { label: 'fontGroup', text: 'font', commands: [] },
      { label: 'paragraphGroup', text: 'paragraph', commands: [] },
      { label: 'editingGroup', commands: [
        { label: 'editTextCommand', icon: 'edit', run: editText, disabled: !target || (target.element === 'image' || target.element === 'shape') || (!mapped.value && !target.prop) },
        { label: 'duplicateObject', icon: 'copy', run: () => target && duplicateBlock(studio, target), disabled: !reorderable.value },
        { label: 'deleteObject', icon: 'trash', run: () => target && deleteBlock(studio, target), disabled: !mapped.value },
      ] },
    ]
    case 'insert': return [
      { label: 'textGroup', commands: [
        { label: 'blockHeading', icon: 'h1', run: () => insertTextBox(true) },
        { label: 'textBox', icon: 'edit', run: () => insertTextBox() },
      ] },
      { label: 'insertTab', commands: [
        { label: 'assets', icon: 'assets', run: () => openLibrary('assets'), pressed: library.value === 'assets' },
        { label: 'components', icon: 'components', run: () => openLibrary('components'), pressed: library.value === 'components' },
      ] },
    ]
    case 'design': return [{ label: 'slide', commands: [
      { label: 'pageSettings', icon: 'settings', run: () => panel('layout') },
    ] }]
    case 'transition': return []
    case 'animate': return [{ label: 'clickSequence', commands: [
      { label: 'animation', icon: 'animate', run: () => panel('animate') },
      { label: 'previousStep', icon: 'up', disabled: nav.clicks.value <= nav.clicksContext.value.clicksStart, run: () => nav.go(studio.no(), nav.clicks.value - 1) },
      { label: 'nextStep', icon: 'down', disabled: nav.clicks.value >= nav.clicksTotal.value, run: () => nav.go(studio.no(), nav.clicks.value + 1) },
    ] }]
    case 'view': return [
      { label: 'panesGroup', commands: [
        { label: 'slides', icon: 'slides', run: () => (slidesVisible.value = !slidesVisible.value), pressed: slidesVisible.value },
        { label: 'properties', icon: 'settings', run: () => (inspectorVisible.value = !inspectorVisible.value), pressed: inspectorVisible.value },
        { label: 'presenterNotes', icon: 'notes', run: () => (notesVisible.value = !notesVisible.value), pressed: notesVisible.value },
      ] },
      { label: 'guidesGroup', commands: [
        { label: 'fitWindow', icon: 'fit', run: () => emit('fit') },
        { label: 'snapGuides', icon: 'magnet', run: () => (snapEnabled.value = !snapEnabled.value), pressed: snapEnabled.value },
        { label: 'snapGrid', icon: 'grid', run: () => (gridEnabled.value = !gridEnabled.value), pressed: gridEnabled.value },
        { label: 'outlineAll', icon: 'eye', run: () => (outlineEnabled.value = !outlineEnabled.value), pressed: outlineEnabled.value },
      ] },
    ]
    case 'object': return [{ label: 'objectTab', commands: [
      ...(!target?.positioned ? [{ label: 'freePosition' as const, icon: 'free', disabled: !mapped.value, run: () => target && freePosition(studio, target) }] : []),
      { label: 'properties', icon: 'settings', run: () => panel('inspect') },
    ] }]
  }
})
</script>

<template>
  <header class="studio-ribbon">
    <div class="studio-titlebar">
      <span class="studio-brand"><StudioIcon name="slides" :size="19" />Studio</span>
      <div class="studio-quick-actions" data-studio-text-controls>
        <button class="studio-icon-button" :disabled="busy || imagePending || projectSaving" :title="t('saveProject') + ' (Ctrl / Cmd + S)'" @click="studio.save"><StudioIcon name="save" /></button>
        <button class="studio-icon-button" :disabled="!undoEnabled" :title="!textActive && lastAction ? t('undoAction', { action: actionText(lastAction) }) : t('undo')" @click="undo"><StudioIcon name="undo" /></button>
        <button class="studio-icon-button" :disabled="!redoEnabled" :title="t('redo')" @click="redo"><StudioIcon name="redo" /></button>
      </div>
      <span class="studio-document-title" :title="title">{{ title }}</span>
      <select v-model="studioLocale" class="studio-language" :aria-label="t('language')"><option value="en">English</option><option value="zh-CN">简体中文</option></select>
      <button class="studio-title-action" :disabled="locked" :title="editing ? t('finishEditing') : t('preview')" @click="emit('preview')"><StudioIcon name="eye" />{{ t('preview') }}</button>
      <button class="studio-title-action studio-title-action--primary" :disabled="locked" :title="editing ? t('finishEditing') : t('presentCurrent')" @click="emit('present')"><StudioIcon name="play" />{{ t('present') }}</button>
      <button class="studio-icon-button" :disabled="locked" :title="t('closeStudio')" @click="studioOpen = false"><StudioIcon name="close" /></button>
    </div>
    <nav class="studio-ribbon-tabs" :aria-label="t('editorTools')" data-studio-text-controls>
      <button class="studio-file-tab" :aria-pressed="ribbonTab === 'file'" :disabled="imagePending || projectSaving" @click="openFile">{{ t('fileTab') }}</button>
      <button v-for="tab in tabs" :key="tab.id" :aria-pressed="ribbonTab === tab.id" @click="ribbonTab = tab.id">{{ t(tab.label) }}</button>
      <button v-if="selection" class="studio-context-tab" :aria-pressed="ribbonTab === 'object'" @click="ribbonTab = 'object'">{{ t('objectTab') }}</button>
    </nav>
    <div v-if="ribbonTab !== 'file'" class="studio-ribbon-tools">
      <div v-if="ribbonTab === 'insert'" class="studio-command-group">
        <details class="studio-picture-menu">
          <summary class="studio-command" :aria-label="t('picture')"><StudioIcon name="assets" :size="20" /><span>{{ t('picture') }} ▾</span></summary>
          <div class="studio-picture-menu__items">
            <button :disabled="locked" @click="images.fromFile(); ($event.currentTarget as HTMLElement).closest('details')?.removeAttribute('open')">{{ t('imageFromFile') }}</button>
            <button :disabled="locked" @click="images.fromLibrary(); ($event.currentTarget as HTMLElement).closest('details')?.removeAttribute('open')">{{ t('imageFromLibrary') }}</button>
          </div>
        </details>
        <span class="studio-command-group__label">{{ t('picture') }}</span>
      </div>
      <div v-if="ribbonTab === 'insert'" class="studio-command-group"><ShapePicker /><span class="studio-command-group__label">{{ t('shapes') }}</span></div>
      <fieldset v-if="ribbonTab === 'transition'" class="studio-transition-quick" :disabled="locked"><PanelTransition /></fieldset>
      <div v-for="group in groups" :key="group.label" class="studio-command-group">
        <TextElementFields v-if="group.text" :group="group.text" />
        <div v-else class="studio-command-group__buttons">
          <button
            v-for="command in group.commands" :key="command.label" class="studio-command"
            :disabled="locked || command.disabled" :aria-pressed="command.pressed" :title="t(command.hint || command.label)" @click="command.run()"
          ><StudioIcon :name="command.icon" :size="20" /><span>{{ t(command.label) }}</span></button>
        </div>
        <span class="studio-command-group__label">{{ t(group.label) }}</span>
      </div>
    </div>
  </header>
</template>
