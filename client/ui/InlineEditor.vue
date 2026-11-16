<script setup lang="ts">
import { action, t } from '../i18n'
import type { ComponentFieldTarget } from '../component-fields'
import { componentFieldElement, resolveComponentField } from '../component-fields'
import { readComponentString, writeComponentString } from '../md/component-fields'
import { useCatalog } from '../composables/useCatalog'
import type { SourceRange } from '../types'
import { nextTick, onScopeDispose, ref, watch } from 'vue'
import { getBlock, replaceBlock } from '../md/lines'
import { editing, editPointer, editSourceRequested, editComponentField, selectedComponentField, activePanel, inspectorVisible, reportError, selectAllOnEdit, selection } from '../state'
import { readEditableText, editableTextTarget } from '../text/source'
import { sourceEditLabel } from '../source-label'
import { useStudio } from '../context'
import { onDomEvent } from '../composables/useDomEvent'
import StudioIcon from './parts/StudioIcon.vue'

const studio = useStudio()
const { components } = useCatalog()
const mode = ref<'plain' | 'rich' | 'source'>('source')
const draft = ref('')
const box = ref<HTMLTextAreaElement | null>(null)
const rect = ref<{ left: number, top: number, width: number } | null>(null)
const sourceLabel = ref<ReturnType<typeof sourceEditLabel>>('editMarkdown')
const held = ref<SourceRange | null>(null)
const fieldNotice = ref(false)
let source = ''
let field: ComponentFieldTarget | null = null
let fieldBlock = ''
let propKey: string | null = null
let originalText = ''
let editable: HTMLElement | null = null
let original = ''
let originalEditable: string | null = null
let originalSpellcheck = true
let originalClass: string | null = null

function place(element: HTMLElement) {
  const at = element.getBoundingClientRect()
  rect.value = { left: at.left, top: at.top, width: Math.max(at.width, 320) }
}

// Detach the editing surface without dropping the session's source range.
function releaseSurface() {
  studio.text.stop()
  if (!editable) return
  editable.removeEventListener('paste', onPaste)
  if (originalEditable === null) editable.removeAttribute('contenteditable')
  else editable.setAttribute('contenteditable', originalEditable)
  editable.spellcheck = originalSpellcheck
  if (originalClass === null) editable.removeAttribute('class')
  else editable.setAttribute('class', originalClass)
  editable.innerHTML = original
  editable = null
}

function release() {
  releaseSurface()
  held.value = null
  propKey = null
  field = null
  fieldNotice.value = false
  rect.value = null
}

function capture(element: HTMLElement) {
  editable = element
  original = element.innerHTML
  originalEditable = element.getAttribute('contenteditable')
  originalSpellcheck = element.spellcheck
  originalClass = element.getAttribute('class')
}

function holdPlain(element: HTMLElement, selectAll = false) {
  capture(element)
  originalText = element.textContent ?? ''
  element.setAttribute('contenteditable', 'true')
  element.classList.add('studio-editing')
  element.addEventListener('paste', onPaste)
  element.spellcheck = false
  const chosen = window.getSelection()
  if (!chosen || !element.contains(chosen.anchorNode)) element.focus()
  if (selectAll && chosen) {
    const all = document.createRange()
    all.selectNodeContents(element)
    chosen.removeAllRanges()
    chosen.addRange(all)
  }
}

watch(editing, async open => {
  if (!open) { release(); return }
  const requestedField = editComponentField.value
  editComponentField.value = null
  const forceSource = editSourceRequested.value
  editSourceRequested.value = false
  const point = editPointer.value
  editPointer.value = null
  const selectAll = selectAllOnEdit.value
  selectAllOnEdit.value = false
  let target = selection.value
  if (!target) { editing.value = false; return }

  const component = components.find(component => component.name === target?.tag)
  if (!forceSource && component && (requestedField || component.propsMode === 'declared' || component.props.some(prop => prop.control === 'richtext' || prop.control === 'image'))) {
    const name = requestedField?.owner.el === target.el ? requestedField.prop.name
      : selectedComponentField.value?.owner === target.el ? selectedComponentField.value.name : null
    const owner = target
    const richFields = component.props.filter(prop => (prop.control === 'richtext' || prop.control === 'text') && componentFieldElement(owner, prop.name))
    const prop = name ? component.props.find(prop => prop.name === name) : richFields.length === 1 ? richFields[0] : null
    if (!prop || prop.control === 'image') {
      activePanel.value = 'inspect'; inspectorVisible.value = true
      editing.value = false
      return
    }
    const node = componentFieldElement(target, prop.name)
    field = node ? resolveComponentField(target, node, component) : null
    field ??= { owner: target, prop, element: null }
    if (!target.range) { editing.value = false; return }
    const value = readComponentString(studio.content(), target.range, prop)
    if (!value.editable) {
      reportError(new Error(t(value.reason === 'unknown-default' ? 'componentFieldDefault' : 'componentFieldCode')))
      activePanel.value = 'inspect'; inspectorVisible.value = true
      editing.value = false
      return
    }
    held.value = [...target.range]
    fieldBlock = getBlock(studio.content(), held.value)
    source = value.value
    sourceLabel.value = 'editHtml'
    place(field.element ?? target.el)
    if (field.element && prop.control === 'text') {
      mode.value = 'plain'
      holdPlain(field.element)
      return
    }
    if (field.element && prop.control === 'richtext') {
      capture(field.element)
      if (studio.text.start(target, source, selectAll, () => { void apply() }, point, field)) {
        mode.value = 'rich'
        field.element.classList.add('studio-editing')
        return
      }
      releaseSurface()
    }
    fieldNotice.value = true
    mode.value = 'source'
    draft.value = source
    await nextTick()
    if (editing.value) box.value?.focus()
    return
  }

  if (!forceSource && target.prop) {
    propKey = target.prop
    source = String(studio.frontmatter()[propKey] ?? '')
    mode.value = 'plain'
    place(target.el)
    holdPlain(target.el, true)
    return
  }

  if (!forceSource) target = editableTextTarget(target)
  if (!target.range) { editing.value = false; return }
  selection.value = target
  held.value = [...target.range]
  source = getBlock(studio.content(), held.value)
  sourceLabel.value = sourceEditLabel(target)
  place(target.el)
  const richSource = forceSource ? null : readEditableText(studio.content(), target)
  if (richSource) {
    capture(target.el)
    if (studio.text.start(target, richSource.html, selectAll, () => { void apply() }, point)) {
      mode.value = 'rich'
      target.el.classList.add('studio-editing')
      return
    }
    releaseSurface()
  }
  mode.value = 'source'
  draft.value = source
  await nextTick()
  if (editing.value && mode.value === 'source') box.value?.focus()
})

async function apply() {
  if (!editing.value) return
  if (mode.value === 'plain') {
    const raw = editable?.textContent ?? ''
    const changed = raw !== originalText
    const written = raw.replace(/\s+/g, ' ').trim()
    const ownedField = field
    const range = held.value
    const key = propKey
    const previous = source
    release()
    editing.value = false
    if (!changed) return
    if (ownedField && range && raw !== previous) {
      if (studio.no() !== ownedField.owner.no || getBlock(studio.content(), range) !== fieldBlock) throw new Error(t('componentFieldChanged'))
      await studio.commit(writeComponentString(studio.content(), range, ownedField.prop, raw), action('actionEditText'))
    }
    else if (key && written !== previous.trim()) {
      await studio.setFrontmatter({ [key]: written }, action('actionSet', { name: key }))
    }
    return
  }
  if (mode.value === 'rich') {
    const pending = studio.text.changed() ? studio.text.apply() : null
    release()
    editing.value = false
    await pending
    return
  }
  const range = held.value
  const ownedField = field
  if (ownedField && range && (studio.no() !== ownedField.owner.no || getBlock(studio.content(), range) !== fieldBlock)) {
    const error = new Error(t('componentFieldChanged'))
    reportError(error)
    throw error
  }
  const written = draft.value
  const previous = source
  release()
  editing.value = false
  if (range && written !== previous)
    await studio.commit(ownedField ? writeComponentString(studio.content(), range, ownedField.prop, written) : replaceBlock(studio.content(), range, written), action('actionEditText'))
}

function cancel() {
  release()
  editing.value = false
}

defineExpose({ apply })

function toSource() {
  if (mode.value !== 'rich') return
  // Read before destroying Tiptap; keep the original write range for apply.
  draft.value = studio.text.changed() ? studio.text.draft() ?? source : source
  releaseSurface()
  mode.value = 'source'
  nextTick(() => box.value?.focus())
}

function onPaste(event: ClipboardEvent) {
  const text = event.clipboardData?.getData('text/plain')
  if (text == null) return
  event.preventDefault()
  document.execCommand('insertText', false, text.replace(/\r?\n/g, ' '))
}

function onKeydown(event: KeyboardEvent) {
  event.stopPropagation()
  if (event.isComposing) return
  const modifier = event.metaKey || event.ctrlKey
  if (event.key === 'Escape' || event.key === 'F2' || (event.key === 'Enter' && (modifier || mode.value === 'plain'))) {
    event.preventDefault()
    void apply()
  }
  else if (mode.value === 'plain' && modifier && ['b', 'i', 'u'].includes(event.key.toLowerCase())) {
    event.preventDefault()
  }
}

onDomEvent<KeyboardEvent>(document, 'keydown', event => {
  if (mode.value !== 'plain' || !editing.value || !editable) return
  if (event.target instanceof Node && editable.contains(event.target)) onKeydown(event)
}, { capture: true })

onDomEvent<PointerEvent>(document, 'pointerdown', event => {
  if (!editing.value || (mode.value === 'source' ? !box.value : !editable)) return
  const target = event.target
  if (!(target instanceof Node)) return
  if (editable?.contains(target) || (target instanceof Element && target.closest('.studio-inline'))) return
  if (mode.value === 'rich' && target instanceof Element && target.closest('[data-studio-text-controls]')) return
  if (mode.value === 'rich' && document.activeElement instanceof HTMLElement
    && document.activeElement.closest('[data-studio-text-controls]')) document.activeElement.blur()
  void apply()
  studio.selectOnPointer(event, false)
}, { capture: true })

onDomEvent(window, 'resize', () => {
  if (editing.value && selection.value) place(selection.value.el)
})
onScopeDispose(release)
</script>

<template>
  <div v-if="editing && rect" class="studio-inline"
    :class="{ 'studio-inline--floating': mode !== 'source' }"
    :style="mode !== 'source'
      ? { left: `${rect.left}px`, top: `${Math.max(4, rect.top - 42)}px` }
      : { left: `${rect.left}px`, top: `${rect.top}px`, width: `${rect.width}px` }">
    <div class="studio-inline__bar">
      <span v-if="mode === 'source'">{{ t(sourceLabel) }}</span>
      <select v-if="mode === 'rich'" v-model="studio.text.pasteMode.value" :title="t('textPasteMode')" :aria-label="t('textPasteMode')" @change="studio.text.editor.value?.commands.focus(undefined, { scrollIntoView: false })">
        <option value="source">{{ t('pasteSource') }}</option>
        <option value="match">{{ t('pasteMatch') }}</option>
        <option value="plain">{{ t('pastePlain') }}</option>
      </select>
      <button v-if="mode === 'rich'" data-studio-edit-source class="studio-icon-button" :title="t('editSource')" @mousedown.prevent @click="toSource"><StudioIcon name="code" :size="14" /></button>
      <button class="studio-icon-button" :title="t('applyShortcut')" @mousedown.prevent @click="apply"><StudioIcon name="check" :size="14" /></button>
      <button class="studio-icon-button" :title="t('cancelEdit')" @mousedown.prevent @click="cancel"><StudioIcon name="close" :size="14" /></button>
    </div>
    <p v-if="fieldNotice" class="studio-hint">{{ t('componentFieldSource') }}</p>
    <p v-if="mode === 'source' && held" class="studio-hint">{{ t('inspectLines', { start: held[0] + 1, end: held[1] }) }}</p>
    <textarea v-if="mode === 'source'" ref="box" v-model="draft" :aria-label="t(sourceLabel)" spellcheck="false" rows="8" @keydown="onKeydown" />
  </div>
</template>
