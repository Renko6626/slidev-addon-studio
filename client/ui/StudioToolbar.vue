<script setup lang="ts">
import type { MessageKey } from '../i18n'
import type { PanelId, RibbonTab } from '../state'
import { computed, watch } from 'vue'
import { configs } from '@slidev/client/env.ts'
import { useNav } from '@slidev/client'
import { action, actionText, studioLocale, t } from '../i18n'
import { canReorder, deleteBlock, duplicateBlock, editText, freePosition, moveBlockBy, returnToFlow } from '../actions'
import { BASIC_BLOCKS } from '../blocks'
import { useStudio } from '../context'
import { useDeckActions } from '../composables/useDeckActions'
import { canRedo, canUndo, lastAction, useStudioHistory } from '../composables/useSlideSource'
import { insertSnippet } from '../md/insert'
import { activePanel, busy, editing, gridEnabled, inspectorVisible, library, notesVisible, outlineEnabled, ribbonTab, selection, slidesVisible, snapEnabled, studioOpen } from '../state'
import PanelTransition from './panels/PanelTransition.vue'
import StudioIcon from './parts/StudioIcon.vue'

const emit = defineEmits<{ preview: [], present: [], fit: [] }>()
const studio = useStudio()
const nav = useNav()
const deck = useDeckActions()
const history = useStudioHistory()
const title = computed(() => configs.title || configs.slidesTitle || 'Slidev Studio')
const locked = computed(() => busy.value || editing.value)
const mapped = computed(() => !!selection.value?.range)
const reorderable = computed(() => !!selection.value?.range && canReorder(selection.value))
const tabs: { id: RibbonTab, label: MessageKey }[] = [
  { id: 'home', label: 'homeTab' }, { id: 'insert', label: 'insertTab' },
  { id: 'design', label: 'designTab' }, { id: 'transition', label: 'transitionsTab' },
  { id: 'animate', label: 'animate' }, { id: 'view', label: 'viewTab' },
]
watch(selection, value => {
  if (!value && ribbonTab.value === 'object')
    ribbonTab.value = 'home'
})
function panel(id: PanelId) {
  activePanel.value = id
  inspectorVisible.value = true
  library.value = null
}
function openLibrary(id: 'components' | 'assets') {
  library.value = library.value === id ? null : id
}
async function insertBasic(index: number) {
  const block = BASIC_BLOCKS[index]
  const range = selection.value?.range
  await studio.commit(insertSnippet(studio.content(), block.snippet, range ? { mode: 'after', range } : { mode: 'append' }), action('actionInsert', { name: { key: block.labelKey } }))
  await studio.selectInserted()
  panel('inspect')
}
interface Command { label: MessageKey, icon: string, run: () => unknown, disabled?: boolean, pressed?: boolean, hint?: MessageKey }
interface Group { label: MessageKey, commands: Command[] }
const groups = computed<Group[]>(() => {
  const target = selection.value
  switch (ribbonTab.value) {
    case 'home': return [
      { label: 'slides', commands: [
        { label: 'newSlide', icon: 'plus', run: () => deck.add(studio.no()), hint: 'deckReloadHint' },
        { label: 'duplicateSlide', icon: 'copy', run: () => deck.duplicate(studio.no()), hint: 'deckReloadHint' },
        { label: 'deleteSlide', icon: 'trash', run: () => deck.remove(studio.no()), disabled: studio.no() === 1, hint: studio.no() === 1 ? 'firstSlideProtected' : 'deckReloadHint' },
        { label: 'layout', icon: 'layout', run: () => panel('layout') },
      ] },
      { label: 'editingGroup', commands: [
        { label: 'editTextCommand', icon: 'edit', run: editText, disabled: !target || (!mapped.value && !target.prop) },
        { label: 'duplicateObject', icon: 'copy', run: () => target && duplicateBlock(studio, target), disabled: !reorderable.value },
        { label: 'deleteObject', icon: 'trash', run: () => target && deleteBlock(studio, target), disabled: !mapped.value },
      ] },
    ]
    case 'insert': return [
      { label: 'textGroup', commands: [
        { label: 'blockHeading', icon: 'h1', run: () => insertBasic(0) },
        { label: 'blockText', icon: 'edit', run: () => insertBasic(1) },
        { label: 'blockList', icon: 'list', run: () => insertBasic(2) },
        { label: 'blockCode', icon: 'code', run: () => insertBasic(7) },
      ] },
      { label: 'insertTab', commands: [
        { label: 'assets', icon: 'assets', run: () => openLibrary('assets'), pressed: library.value === 'assets' },
        { label: 'components', icon: 'components', run: () => openLibrary('components'), pressed: library.value === 'components' },
      ] },
    ]
    case 'design': return [{ label: 'slide', commands: [
      { label: 'layout', icon: 'layout', run: () => panel('layout') },
      { label: 'pageSettings', icon: 'settings', run: () => panel('layout') },
    ] }]
    case 'transition': return [{ label: 'slideTransition', commands: [
      { label: 'properties', icon: 'settings', run: () => panel('transition') },
    ] }]
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
      { label: target?.positioned ? 'returnFlow' : 'freePosition', icon: target?.positioned ? 'flow' : 'free', disabled: !mapped.value, run: () => target && (target.positioned ? returnToFlow(studio, target) : freePosition(studio, target)) },
      { label: 'moveEarlier', icon: 'up', run: () => target && moveBlockBy(studio, target, -1), disabled: !reorderable.value, hint: 'documentOrderHint' },
      { label: 'moveLater', icon: 'down', run: () => target && moveBlockBy(studio, target, 1), disabled: !reorderable.value, hint: 'documentOrderHint' },
      { label: 'properties', icon: 'settings', run: () => panel('inspect') },
    ] }]
  }
})
</script>

<template>
  <header class="studio-ribbon">
    <div class="studio-titlebar">
      <span class="studio-brand"><StudioIcon name="slides" :size="19" />Studio</span>
      <div class="studio-quick-actions">
        <button class="studio-icon-button" :disabled="!canUndo || locked" :title="lastAction ? t('undoAction', { action: actionText(lastAction) }) : t('undo')" @click="history.undo()"><StudioIcon name="undo" /></button>
        <button class="studio-icon-button" :disabled="!canRedo || locked" :title="t('redo')" @click="history.redo()"><StudioIcon name="redo" /></button>
      </div>
      <span class="studio-document-title" :title="title">{{ title }}</span>
      <select v-model="studioLocale" class="studio-language" :aria-label="t('language')"><option value="en">English</option><option value="zh-CN">简体中文</option></select>
      <button class="studio-title-action" :disabled="locked" :title="editing ? t('finishEditing') : t('preview')" @click="emit('preview')"><StudioIcon name="eye" />{{ t('preview') }}</button>
      <button class="studio-title-action studio-title-action--primary" :disabled="locked" :title="editing ? t('finishEditing') : t('presentCurrent')" @click="emit('present')"><StudioIcon name="play" />{{ t('present') }}</button>
      <button class="studio-icon-button" :disabled="locked" :title="t('closeStudio')" @click="studioOpen = false"><StudioIcon name="close" /></button>
    </div>
    <nav class="studio-ribbon-tabs" :aria-label="t('editorTools')">
      <button v-for="tab in tabs" :key="tab.id" :aria-pressed="ribbonTab === tab.id" @click="ribbonTab = tab.id">{{ t(tab.label) }}</button>
      <button v-if="selection" class="studio-context-tab" :aria-pressed="ribbonTab === 'object'" @click="ribbonTab = 'object'">{{ t('objectTab') }}</button>
    </nav>
    <div class="studio-ribbon-tools">
      <fieldset v-if="ribbonTab === 'transition'" class="studio-transition-quick" :disabled="locked"><PanelTransition /></fieldset>
      <div v-for="group in groups" :key="group.label" class="studio-command-group">
        <div class="studio-command-group__buttons">
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
