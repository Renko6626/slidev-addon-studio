import { computed, onScopeDispose, ref, shallowRef } from 'vue'
import type { Editor } from '@tiptap/core'
import type { Node as TextNode } from '@tiptap/pm/model'
import type { StudioContext } from '../context'
import type { ComponentFieldTarget } from '../component-fields'
import { readComponentString, writeComponentString } from '../md/component-fields'
import { t } from '../i18n'
import type { StudioTarget } from '../types'
import { action } from '../i18n'
import { busy, editing, selection } from '../state'
import { getBlock } from '../md/lines'
import { readEditableText, writeEditableText, editableTextTarget } from '../text/source'
import type { EditableTextSource } from '../text/source'
import { applyTextCommand, createTextEditor, prepareTextHTML, readTextFormat, selectTextWord, pasteText } from '../text/editor'
import type { TextCommand, TextDefaults } from '../text/editor'
import { tableCellDefaults, tableCellEditor, tableCellRevision } from '../table-cell-text'

interface ComponentTextSource {
  kind: 'component'
  html: string
  field: ComponentFieldTarget
  block: string
  no: number
}
type TextSource = EditableTextSource | ComponentTextSource

/** Text boxes and native prose share commands, selection and editing history. */
export function useTextEditor(studio: Pick<StudioContext, 'content' | 'commit'> & Partial<Pick<StudioContext, 'selectInserted' | 'no'>>) {
  const textEditor = shallowRef<Editor | null>(null)
  /** The formatting surface in use: a text box, or the rich cell being edited. */
  const activeEditor = computed(() => textEditor.value ?? tableCellEditor.value)
  const cellActive = computed(() => !textEditor.value && !!tableCellEditor.value)
  const revision = ref(0)
  const pasteMode = ref<'source' | 'match' | 'plain'>('source')
  const activeDefaults = shallowRef<TextDefaults | null>(null)
  const activeSource = shallowRef<TextSource | null>(null)
  let originalDoc: TextNode | null = null
  let stopKeys: (() => void) | null = null

  const textSource = computed(() => {
    const target = selection.value
    return activeSource.value ?? (target ? readEditableText(studio.content(), target) : null)
  })
  const sourceHTML = computed(() => textSource.value?.html ?? null)
  const supported = computed(() => textSource.value !== null || !!tableCellEditor.value)
  const defaults = computed<TextDefaults>(() => {
    if (cellActive.value) return tableCellDefaults.value
    if (activeDefaults.value) return activeDefaults.value
    const el = activeSource.value?.kind === 'component' ? activeSource.value.field.element : selection.value?.el
    if (!el) return {}
    const style = getComputedStyle(el)
    const fontSize = Number.parseFloat(style.fontSize) || 28
    return {
      fontFamily: style.fontFamily || 'sans-serif', fontSize,
      color: style.color || '#000000', align: style.textAlign === 'start' ? 'left' : style.textAlign || 'left',
      lineHeight: style.lineHeight === 'normal' ? '1.3' : String(Math.round((Number.parseFloat(style.lineHeight) / fontSize || 1.3) * 100) / 100),
      bold: style.fontWeight === 'bold' || Number(style.fontWeight) >= 600,
      italic: style.fontStyle === 'italic', underline: style.textDecorationLine.includes('underline'),
      strike: style.textDecorationLine.includes('line-through'),
    }
  })
  const format = computed(() => {
    revision.value
    tableCellRevision.value
    if (activeEditor.value) return readTextFormat(activeEditor.value.state, defaults.value)
    if (!supported.value) return null
    const temporary = createTextEditor(sourceHTML.value!)
    try {
      temporary.commands.selectAll()
      return readTextFormat(temporary.state, defaults.value)
    }
    finally { temporary.destroy() }
  })
  const scope = computed(() => {
    revision.value
    tableCellRevision.value
    if (!activeEditor.value) return 'textScopeBox'
    return activeEditor.value.state.selection.empty ? 'textScopeTyping' : 'textScopeSelection'
  })
  const canUndo = computed(() => {
    revision.value
    tableCellRevision.value
    return activeEditor.value?.can().undo() ?? false
  })
  const canRedo = computed(() => {
    revision.value
    tableCellRevision.value
    return activeEditor.value?.can().redo() ?? false
  })

  function stop() {
    stopKeys?.()
    stopKeys = null
    textEditor.value?.destroy()
    textEditor.value = null
    originalDoc = null
    activeDefaults.value = null
    activeSource.value = null
  }

  function start(target: StudioTarget, html: string, selectAll: boolean, finish: () => void, point?: { x: number, y: number } | null, field?: ComponentFieldTarget): boolean {
    target = field ? target : editableTextTarget(target)
    const source: TextSource | null = field?.element && field.owner.range
      ? { kind: 'component', html, field, block: getBlock(studio.content(), field.owner.range), no: field.owner.no }
      : readEditableText(studio.content(), target)
    if (!source || prepareTextHTML(html) === null) return false
    stop()
    activeSource.value = source
    const inherited = defaults.value
    activeDefaults.value = inherited
    const root = field?.element ?? target.el
    const element = root.querySelector<HTMLElement>(':scope > [data-studio-text-content]') ?? root
    element.replaceChildren()
    const instance = createTextEditor(html, {
      element,
      editorProps: {
        attributes: { class: `studio-rich-editor${source.kind === 'native' ? ' studio-rich-editor--native' : ''}`, style: 'outline:none;white-space:pre-wrap;min-height:1em;font:inherit;color:inherit;' },
        handlePaste: (_view, event) => {
          if (pasteMode.value === 'source') return false
          const text = event.clipboardData?.getData('text/plain')
          if (text === undefined) return false
          event.preventDefault()
          return pasteText(instance, text, pasteMode.value === 'match')
        },
        handleKeyDown: (_view, event) => {
          if (event.isComposing || instance.view.composing) return false
          const modifier = event.ctrlKey || event.metaKey
          if (event.key === 'Escape' || event.key === 'F2' || (modifier && event.key === 'Enter')) {
            event.preventDefault()
            finish()
            return true
          }
          const command = modifier && !event.altKey && !event.shiftKey
            ? ({ b: 'bold', i: 'italic', u: 'underline' } as const)[event.key.toLowerCase() as 'b' | 'i' | 'u'] : undefined
          if (command) {
            event.preventDefault()
            return applyTextCommand(instance, command, undefined, inherited)
          }
          return false
        },
      },
      onTransaction: () => revision.value++,
    })
    textEditor.value = instance
    originalDoc = instance.state.doc
    // Let ProseMirror handle the key first, then keep it away from Slidev.
    const stopPropagation = (event: Event) => event.stopPropagation()
    instance.view.dom.addEventListener('keydown', stopPropagation)
    stopKeys = () => instance.view.dom.removeEventListener('keydown', stopPropagation)
    if (selectAll) instance.commands.selectAll()
    else {
      const clicked = point ? instance.view.posAtCoords({ left: point.x, top: point.y }) : null
      instance.commands.setTextSelection(clicked?.pos ?? instance.state.doc.content.size - 1)
      if (clicked) selectTextWord(instance, clicked.pos)
    }
    instance.commands.focus(undefined, { scrollIntoView: false })
    return true
  }

  async function apply(html?: string, source = textSource.value, label = action('actionEditText')) {
    if (!source) return
    if (html === undefined) {
      if (!textEditor.value || !originalDoc || originalDoc.eq(textEditor.value.state.doc)) return
      html = textEditor.value.getHTML()
    }
    if (source.kind === 'component') {
      const { field, block, no } = source
      const range = field.owner.range!
      if (studio.no && studio.no() !== no || getBlock(studio.content(), range) !== block)
        throw new Error(t('componentFieldChanged'))
      const readable = readComponentString(studio.content(), range, field.prop)
      if (!readable.editable) throw new Error(t('componentFieldCode'))
      await studio.commit(writeComponentString(studio.content(), range, field.prop, html), label)
      return
    }
    const result = writeEditableText(studio.content(), source, html)
    if (result.content === studio.content()) return
    const selected = selection.value
    await studio.commit(result.content, label, source.kind === 'native' ? { keepSelection: true } : undefined)
    if (source.kind === 'native' && selection.value === selected)
      await studio.selectInserted?.(result.tag, result.range)
  }

  async function run(command: TextCommand, value?: string) {
    if (busy.value) return
    const active = activeEditor.value
    if (active) {
      applyTextCommand(active, command, value, defaults.value)
      active.commands.focus(undefined, { scrollIntoView: false })
      return
    }
    const target = selection.value
    if (editing.value || !supported.value || !target?.range) return
    const source = textSource.value!
    const temporary = createTextEditor(sourceHTML.value!)
    try {
      const before = temporary.state.doc
      temporary.commands.selectAll()
      applyTextCommand(temporary, command, value, defaults.value)
      if (!before.eq(temporary.state.doc))
        await apply(temporary.getHTML(), source, action('actionElementFormat'))
    }
    finally { temporary.destroy() }
  }

  function undo() {
    activeEditor.value?.commands.undo()
    activeEditor.value?.commands.focus(undefined, { scrollIntoView: false })
  }

  function redo() {
    activeEditor.value?.commands.redo()
    activeEditor.value?.commands.focus(undefined, { scrollIntoView: false })
  }

  onScopeDispose(stop)
  return {
    pasteMode, editor: activeEditor, cellActive, supported, format, scope, canUndo, canRedo, start, stop, run, apply, undo, redo,
    draft: () => {
      if (!textEditor.value || !textSource.value) return null
      const content = studio.content()
      const source = textSource.value
      if (source.kind === 'component') return textEditor.value.getHTML()
      const result = writeEditableText(content, source, textEditor.value.getHTML())
      const addedLines = result.content.split('\n').length - content.split('\n').length
      return getBlock(result.content, [source.range[0], source.range[1] + addedLines])
    },
    html: () => textEditor.value?.getHTML() ?? '',
    changed: () => !!textEditor.value && !!originalDoc && !originalDoc.eq(textEditor.value.state.doc),
  }
}