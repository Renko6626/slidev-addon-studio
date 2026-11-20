<script setup lang="ts">
import type { MessageKey } from '../i18n'
import type { TableCellPosition } from '../md/table-cell'
import type { PanelId, RibbonTab } from '../state'
import { computed, watch } from 'vue'
import { configs } from '@slidev/client/env.ts'
import { useNav } from '@slidev/client'
import studioLogo from '../assets/studio.svg'
import { action, actionText, studioLocale, t } from '../i18n'
import { canReorder, deleteBlock, duplicateBlock, editText, freePosition } from '../actions'
import { useStudio } from '../context'
import { useDeckActions } from '../composables/useDeckActions'
import { projectSaving } from '../project-save'
import { projectHost } from '../project-host'
import { studioWorkspace } from '../composables/useCatalog'
import { returnToActivity } from '../workspace'
import { canRedo, canUndo, lastAction, useStudioHistory } from '../composables/useSlideSource'
import { appendElement, createTextElement, patchElementStyle } from '../md/elements'
import { createInteractionButton, createQuizPage, listQuestions, readInteraction } from '../md/interactions'
import { DEFAULT_TABLE_SNIPPET } from '../../shared/table'
import { addColumn, addRow, mergeAt, mergeTableRange, removeColumn, removeRow, splitTableMerge } from '../../shared/table'
import { readTable, writeTable, writeTableStyle } from '../md/table'
import { tableWithRich } from '../md/table-rich'
import { clampTableCell, defaultTableCell, tableRectIsFree } from '../md/table-cell'
import { imageLibraryRequest, imagePending, useImageInsertion } from '../composables/useImageInsertion'
import ShapePicker from './parts/ShapePicker.vue'
import ArrangeSelection from './parts/ArrangeSelection.vue'
import TextElementFields from './parts/TextElementFields.vue'
import { activePanel, busy, clearSelection, editing, gridEnabled, inspectorVisible, library, notesVisible, outlineEnabled, ribbonTab, selectAllOnEdit, selection, selectedTargets, slidesVisible, snapEnabled, studioOpen, reportError, tableCell, tableEditing, tableEditRequest, tableRange } from '../state'
import PanelTransition from './panels/PanelTransition.vue'
import StudioIcon from './parts/StudioIcon.vue'

const emit = defineEmits<{ preview: [], present: [], fit: [] }>()
const studio = useStudio()
const desktop = !!projectHost()
function backToActivity() {
  if (studioWorkspace) void returnToActivity(studioWorkspace, studio.save).catch(reportError)
}
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
const locked = computed(() => busy.value || editing.value || tableEditing.value || imagePending.value)
const mapped = computed(() => !!selection.value?.range)
const reorderable = computed(() => !!selection.value?.range && canReorder(selection.value))
const quizQuestions = computed(() => listQuestions(studio.content()).filter((item, _index, all) => item.value.question && item.value.mode && item.value.options?.length
  && all.filter(other => other.value.question === item.value.question).length === 1))
const tabs: { id: RibbonTab, label: MessageKey }[] = [
  { id: 'home', label: 'homeTab' }, { id: 'insert', label: 'insertTab' },
  { id: 'design', label: 'designTab' }, { id: 'transition', label: 'transitionsTab' },
  { id: 'animate', label: 'animate' }, { id: 'view', label: 'viewTab' },
]
async function openFile() {
  if (ribbonTab.value === 'file') { ribbonTab.value = 'home'; return }
  if (imagePending.value || projectSaving.value) return
  await studio.save()
  if (editing.value || tableEditing.value) return
  clearSelection()
  library.value = null
  ribbonTab.value = 'file'
}
watch(selection, value => {
  if (!value && (ribbonTab.value === 'object' || ribbonTab.value === 'table'))
    ribbonTab.value = 'home'
  else if (value && value.tag !== 'StudioTable' && ribbonTab.value === 'table')
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
async function insertTable() {
  if (locked.value) return
  const no = studio.no()
  const inserted = appendElement(studio.content(), DEFAULT_TABLE_SNIPPET)
  await studio.commit(inserted.content, action('actionInsert', { name: { key: 'table' } }))
  if (studio.no() !== no || !await studio.selectInserted('StudioTable', inserted.range)) return
  panel('inspect')
}

function activeTable() {
  const target = selection.value
  if (!target?.range || target.tag !== 'StudioTable')
    return null
  const read = readTable(studio.content(), target.range)
  if (read.unparsed)
    return null
  const position = tableCell.value
    ? clampTableCell(read.table, tableCell.value)
    : defaultTableCell(read.table)
  return { range: target.range, table: read.table, position }
}

async function commitTable(next: ReturnType<typeof readTable>['table'], position?: TableCellPosition | null) {
  const active = activeTable()
  if (!active || locked.value)
    return
  await studio.commit(writeTable(studio.content(), active.range, next), action('actionTableEdit'))
  if (position !== undefined)
    tableCell.value = position
}

function insertTableRow(where: 'above' | 'below') {
  const active = activeTable()
  if (!active?.position)
    return
  const at = active.position.row === null ? 0 : active.position.row + (where === 'below' ? 1 : 0)
  return commitTable(addRow(active.table, at), { row: at, column: active.position.column })
}

function deleteTableRow() {
  const active = activeTable()
  if (!active?.position || active.position.row === null)
    return
  const next = removeRow(active.table, active.position.row)
  return commitTable(next, clampTableCell(next, { row: active.position.row, column: active.position.column }))
}

function insertTableColumn(side: 'left' | 'right') {
  const active = activeTable()
  if (!active?.position)
    return
  const at = active.position.column + (side === 'right' ? 1 : 0)
  const next = addColumn(active.table, at, { label: t('tableColumn', { index: at + 1 }) })
  return commitTable(next, { row: active.position.row, column: at })
}

function deleteTableColumn() {
  const active = activeTable()
  if (!active?.position || active.table.columns.length <= 1)
    return
  const next = removeColumn(active.table, active.position.column)
  return commitTable(next, clampTableCell(next, { row: active.position.row, column: active.position.column }))
}

function editTableCell() {
  const active = activeTable()
  if (!active?.position)
    return
  panel('inspect')
  tableEditRequest.value = active.position
}

function alignTableCell(align: 'left' | 'center' | 'right') {
  const active = activeTable()
  if (!active?.position)
    return
  const next = {
    ...active.table,
    columns: active.table.columns.map((column, index) => index === active.position!.column ? { ...column, align } : column),
  }
  return commitTable(next)
}

function toggleTableStyle(key: 'header' | 'border' | 'striped') {
  const active = activeTable()
  if (!active || locked.value)
    return
  return studio.commit(
    writeTableStyle(studio.content(), active.range, { [key]: !active.table[key] }),
    action('actionTableEdit'),
  )
}

function addTableRowEnd() {
  const active = activeTable()
  if (!active?.table.columns.length)
    return
  const next = addRow(active.table)
  return commitTable(next, { row: next.rows.length - 1, column: 0 })
}

function addTableColumnEnd() {
  const active = activeTable()
  if (!active)
    return
  const at = active.table.columns.length
  const next = addColumn(active.table, at, { label: t('tableColumn', { index: at + 1 }) })
  return commitTable(next, clampTableCell(next, { row: active.position?.row ?? null, column: at }))
}

const mergeReady = computed(() => {
  const active = activeTable()
  const rect = tableRange.value
  if (!active || !rect)
    return false
  if (rect.rowStart === rect.rowEnd && rect.columnStart === rect.columnEnd)
    return false
  return tableRectIsFree(active.table, rect)
})

const splitReady = computed(() => {
  const active = activeTable()
  const position = active?.position
  return !!active && !!position && !!mergeAt(active.table, position.row ?? -1, position.column)
})

async function mergeTableCells() {
  const active = activeTable()
  const rect = tableRange.value
  if (!active || !rect || locked.value)
    return
  const next = mergeTableRange(active.table, rect)
  if (next === active.table)
    return
  tableRange.value = null
  await commitTable(next, { row: rect.rowStart === -1 ? null : rect.rowStart, column: rect.columnStart })
}

async function splitTableCell() {
  const active = activeTable()
  if (!active?.position || locked.value)
    return
  const next = splitTableMerge(active.table, active.position.row ?? -1, active.position.column)
  if (next === active.table)
    return
  await commitTable(next, clampTableCell(next, active.position))
}

async function toggleTableRich() {
  const active = activeTable()
  if (!active || locked.value)
    return
  const next = tableWithRich(active.table, !active.table.rich)
  if (next === active.table)
    return
  await commitTable(next, active.position)
}

async function insertQuiz(mode: 'single' | 'multiple') {
  if (locked.value) return
  const page = createQuizPage(mode, { width: studio.canvas.slideWidth.value, height: studio.canvas.slideHeight.value }, {
    name: t(mode === 'single' ? 'quizSingle' : 'quizMultiple'),
    title: t(mode === 'single' ? 'quizSingleDefaultTitle' : 'quizMultipleDefaultTitle'),
    options: [t('quizDefaultOptionA'), t('quizDefaultOptionB'), t('quizDefaultOptionC'), t('quizDefaultOptionD')],
    correct: t('quizDefaultCorrect'), incorrect: t('quizDefaultIncorrect'), idle: t('quizDefaultIdle'), submit: t('quizSubmit'), clear: t('quizClear'),
  })
  await deck.add(studio.no(), page.content, page.frontmatter)
}
async function insertQuizButton() {
  if (locked.value || !quizQuestions.value.length) return
  const target = selection.value?.range ? readInteraction(studio.content(), selection.value.range) : null
  const question = quizQuestions.value.find(item => item.value.question === target?.question)?.value.question ?? quizQuestions.value[0].value.question!
  const snippet = createInteractionButton(studio.content(), { width: studio.canvas.slideWidth.value, height: studio.canvas.slideHeight.value }, t('quizButton'), question)
  if (!snippet) return
  const inserted = appendElement(studio.content(), snippet)
  const no = studio.no()
  await studio.commit(inserted.content, action('actionInsert', { name: { key: 'quizButton' } }))
  if (studio.no() === no) await studio.selectInserted('StudioButton', inserted.range)
  panel('inspect')
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
      ...(studio.text.supported.value && selectedTargets.value.length <= 1 ? ([
        { label: 'fontGroup', text: 'font', commands: [] },
        ...(!studio.text.cellActive.value ? [{ label: 'paragraphGroup', text: 'paragraph', commands: [] }] : []),
      ] as Group[]) : []),
      { label: 'editingGroup', commands: [
        { label: 'editTextCommand', icon: 'edit', run: editText, disabled: selectedTargets.value.length > 1 || !target || target.el.hasAttribute('data-studio-question-control') || (target.element === 'image' || target.element === 'shape') || (!mapped.value && !target.prop) },
        { label: 'duplicateObject', icon: 'copy', run: () => target && duplicateBlock(studio, target), disabled: !reorderable.value },
        { label: 'deleteObject', icon: 'trash', run: () => target && deleteBlock(studio, target), disabled: !mapped.value },
      ] },
    ]
    case 'insert': return [
      { label: 'textGroup', commands: [
        { label: 'blockHeading', icon: 'h1', run: () => insertTextBox(true) },
        { label: 'textBox', icon: 'edit', run: () => insertTextBox() },
        { label: 'table', icon: 'grid', run: insertTable },
      ] },
      { label: 'insertTab', commands: [
        { label: 'assets', icon: 'assets', run: () => openLibrary('assets'), pressed: library.value === 'assets' },
        { label: 'components', icon: 'components', run: () => openLibrary('components'), pressed: library.value === 'components' },
      ] },
      { label: 'quizInteractions', commands: [
        { label: 'quizSinglePage', icon: 'list', run: () => insertQuiz('single') },
        { label: 'quizMultiplePage', icon: 'check', run: () => insertQuiz('multiple') },
        { label: 'quizButton', icon: 'cursor', run: insertQuizButton, disabled: !quizQuestions.value.length, hint: !quizQuestions.value.length ? 'quizButtonNeedsQuestion' : 'quizButton' },
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
        { label: 'layers', icon: 'slides', run: () => panel('layers'), pressed: inspectorVisible.value && activePanel.value === 'layers' },
        { label: 'sourcePanel', icon: 'code', run: () => panel('source'), pressed: inspectorVisible.value && activePanel.value === 'source' },
        { label: 'presenterNotes', icon: 'notes', run: () => (notesVisible.value = !notesVisible.value), pressed: notesVisible.value },
      ] },
      { label: 'guidesGroup', commands: [
        { label: 'fitWindow', icon: 'fit', run: () => emit('fit') },
        { label: 'snapGuides', icon: 'magnet', run: () => (snapEnabled.value = !snapEnabled.value), pressed: snapEnabled.value },
        { label: 'snapGrid', icon: 'grid', run: () => (gridEnabled.value = !gridEnabled.value), pressed: gridEnabled.value },
        { label: 'outlineAll', icon: 'eye', run: () => (outlineEnabled.value = !outlineEnabled.value), pressed: outlineEnabled.value },
      ] },
    ]
    case 'table': {
      const current = activeTable()
      const tableLocked = locked.value || !current
      const position = current?.position ?? null
      const column = position && current ? current.table.columns[position.column] : null
      return [
        { label: 'tableRowsGroup', commands: [
          { label: 'insertRowAbove', icon: 'plus', run: () => insertTableRow('above'), disabled: tableLocked || !position },
          { label: 'insertRowBelow', icon: 'plus', run: () => insertTableRow('below'), disabled: tableLocked || !position },
          { label: 'tableDeleteRow', icon: 'trash', run: deleteTableRow, disabled: tableLocked || !position || position.row === null },
          { label: 'tableAddRow', icon: 'plus', run: addTableRowEnd, disabled: tableLocked || !current?.table.columns.length },
        ] },
        { label: 'tableColumnsGroup', commands: [
          { label: 'insertColumnLeft', icon: 'plus', run: () => insertTableColumn('left'), disabled: tableLocked || !position },
          { label: 'insertColumnRight', icon: 'plus', run: () => insertTableColumn('right'), disabled: tableLocked || !position },
          { label: 'tableDeleteColumn', icon: 'trash', run: deleteTableColumn, disabled: tableLocked || !position || (current?.table.columns.length ?? 0) <= 1 },
          { label: 'tableAddColumn', icon: 'plus', run: addTableColumnEnd, disabled: tableLocked },
        ] },
        { label: 'tableMergeGroup', commands: [
          { label: 'tableMerge', icon: 'components', run: mergeTableCells, disabled: tableLocked || !mergeReady.value },
          { label: 'tableSplit', icon: 'flow', run: splitTableCell, disabled: tableLocked || !splitReady.value },
        ] },
        { label: 'tableCellGroup', commands: [
          { label: 'tableEditCell', icon: 'edit', run: editTableCell, disabled: tableLocked || !position },
          { label: 'alignLeft', icon: 'align-left', run: () => alignTableCell('left'), pressed: column?.align === 'left', disabled: tableLocked || !position },
          { label: 'alignCenter', icon: 'align-center', run: () => alignTableCell('center'), pressed: column?.align === 'center', disabled: tableLocked || !position },
          { label: 'alignRight', icon: 'align-right', run: () => alignTableCell('right'), pressed: column?.align === 'right', disabled: tableLocked || !position },
        ] },
        { label: 'tableStyleGroup', commands: [
          { label: 'tableHeader', icon: 'layout', run: () => toggleTableStyle('header'), pressed: !!current?.table.header, disabled: tableLocked },
          { label: 'tableBorder', icon: 'grid', run: () => toggleTableStyle('border'), pressed: !!current?.table.border, disabled: tableLocked },
          { label: 'tableStriped', icon: 'list', run: () => toggleTableStyle('striped'), pressed: !!current?.table.striped, disabled: tableLocked },
          { label: 'tableRich', icon: 'edit', run: toggleTableRich, pressed: !!current?.table.rich, disabled: tableLocked, hint: 'tableRichHint' },
        ] },
      ]
    }
    case 'object': return [{ label: 'objectTab', commands: [
      ...(!target?.positioned ? [{ label: 'freePosition' as const, icon: 'free', disabled: !mapped.value, run: () => target && freePosition(studio, target) }] : []),
      { label: 'properties', icon: 'settings', run: () => panel('inspect') },
      { label: 'layers', icon: 'slides', run: () => panel('layers') },
      { label: 'sourcePanel', icon: 'code', run: () => panel('source') },
    ] }]
  }
})
</script>

<template>
  <header class="studio-ribbon">
    <div class="studio-titlebar" :class="{ 'studio-titlebar--desktop': desktop }">
      <span class="studio-brand"><img class="studio-logo" :src="studioLogo" width="22" height="22" alt="">Studio</span>
      <div class="studio-quick-actions" data-studio-text-controls>
        <button class="studio-icon-button" :disabled="busy || imagePending || projectSaving" :title="t('saveProject') + ' (Ctrl / Cmd + S)'" @click="studio.save"><StudioIcon name="save" /></button>
        <button class="studio-icon-button" :disabled="!undoEnabled" :title="!textActive && lastAction ? t('undoAction', { action: actionText(lastAction) }) : t('undo')" @click="undo"><StudioIcon name="undo" /></button>
        <button class="studio-icon-button" :disabled="!redoEnabled" :title="t('redo')" @click="redo"><StudioIcon name="redo" /></button>
      </div>
      <span class="studio-document-title" :title="title">{{ title }}</span>
      <span v-if="studioWorkspace" class="studio-workspace-label" :title="t('onlineDraftHint')">{{ studioWorkspace.name }}<small>{{ t('onlinePersonalDraft') }}</small></span>
      <button v-if="studioWorkspace" class="studio-title-action" :disabled="busy || imagePending || projectSaving" @click="backToActivity"><StudioIcon name="back" />{{ t('returnToActivity') }}</button>
      <select v-model="studioLocale" class="studio-language" :aria-label="t('language')"><option value="en">English</option><option value="zh-CN">简体中文</option></select>
      <button class="studio-title-action" :disabled="locked" :title="editing ? t('finishEditing') : t('preview')" @click="emit('preview')"><StudioIcon name="eye" />{{ t('preview') }}</button>
      <button class="studio-title-action studio-title-action--primary" :disabled="locked" :title="editing ? t('finishEditing') : t('presentCurrent')" @click="emit('present')"><StudioIcon name="play" />{{ t('present') }}</button>
      <button class="studio-icon-button" :disabled="locked" :title="t('closeStudio')" @click="studioOpen = false"><StudioIcon name="close" /></button>
    </div>
    <nav class="studio-ribbon-tabs" :aria-label="t('editorTools')" data-studio-text-controls>
      <button class="studio-file-tab" :aria-pressed="ribbonTab === 'file'" :disabled="imagePending || projectSaving" @click="openFile">{{ t('fileTab') }}</button>
      <button v-for="tab in tabs" :key="tab.id" :aria-pressed="ribbonTab === tab.id" @click="ribbonTab = tab.id">{{ t(tab.label) }}</button>
      <button v-if="selection" class="studio-context-tab" :aria-pressed="ribbonTab === 'object'" @click="ribbonTab = 'object'">{{ t('objectTab') }}</button>
      <button v-if="selection?.tag === 'StudioTable'" class="studio-context-tab" :aria-pressed="ribbonTab === 'table'" @click="ribbonTab = 'table'">{{ t('tableTab') }}</button>
    </nav>
    <div v-if="ribbonTab !== 'file'" class="studio-ribbon-tools" role="region" :aria-label="t('editorTools')" tabindex="0">
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
      <div v-if="selectedTargets.length > 1 && (ribbonTab === 'home' || ribbonTab === 'object')" class="studio-command-group"><ArrangeSelection /></div>
      <div v-for="group in groups" :key="group.label" class="studio-command-group">
        <fieldset v-if="group.text" class="studio-multi-text-fields" :disabled="selectedTargets.length > 1"><TextElementFields :group="group.text" :compact="studio.text.cellActive.value" /></fieldset>
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
