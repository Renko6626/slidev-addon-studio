import { computed, onScopeDispose, ref, shallowRef } from 'vue'
import type { Editor } from '@tiptap/core'
import type { Node as TextNode } from '@tiptap/pm/model'
import type { StudioContext } from '../context'
import type { StudioTarget } from '../types'
import { action } from '../i18n'
import { busy, editing, selection } from '../state'
import { readEditableText, writeEditableText } from '../text/source'
import type { EditableTextSource } from '../text/source'
import { applyTextCommand, createTextEditor, prepareTextHTML, readTextFormat } from '../text/editor'
import type { TextCommand, TextDefaults } from '../text/editor'

/** Text boxes and native prose share commands, selection and editing history. */
export function useTextEditor(studio: Pick<StudioContext, 'content' | 'commit'> & Partial<Pick<StudioContext, 'selectInserted'>>) {
  const editor = shallowRef<Editor | null>(null)
  const revision = ref(0)
  const activeDefaults = shallowRef<TextDefaults | null>(null)
  const activeSource = shallowRef<EditableTextSource | null>(null)
  let originalDoc: TextNode | null = null
  let stopKeys: (() => void) | null = null

  const textSource = computed(() => {
    const target = selection.value
    return activeSource.value ?? (target ? readEditableText(studio.content(), target) : null)
  })
  const sourceHTML = computed(() => textSource.value?.html ?? null)
  const supported = computed(() => textSource.value !== null)
  const defaults = computed<TextDefaults>(() => {
    if (activeDefaults.value) return activeDefaults.value
    const el = selection.value?.el
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
    if (editor.value) return readTextFormat(editor.value.state, defaults.value)
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
    return !editor.value ? 'textScopeBox' : editor.value.state.selection.empty ? 'textScopeTyping' : 'textScopeSelection'
  })
  const canUndo = computed(() => { revision.value; return editor.value?.can().undo() ?? false })
  const canRedo = computed(() => { revision.value; return editor.value?.can().redo() ?? false })

  function stop() {
    stopKeys?.()
    stopKeys = null
    editor.value?.destroy()
    editor.value = null
    originalDoc = null
    activeDefaults.value = null
    activeSource.value = null
  }

  function start(target: StudioTarget, html: string, selectAll: boolean, finish: () => void, point?: { x: number, y: number } | null): boolean {
    const source = readEditableText(studio.content(), target)
    if (!source || prepareTextHTML(html) === null) return false
    const inherited = defaults.value
    stop()
    activeDefaults.value = inherited
    activeSource.value = source
    target.el.replaceChildren()
    const instance = createTextEditor(html, {
      element: target.el,
      editorProps: {
        attributes: { class: `studio-rich-editor${source.kind === 'native' ? ' studio-rich-editor--native' : ''}`, style: 'outline:none;white-space:pre-wrap;min-height:1em;font:inherit;color:inherit;' },
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
    editor.value = instance
    originalDoc = instance.state.doc
    // Let ProseMirror handle the key first, then keep it away from Slidev.
    const stopPropagation = (event: Event) => event.stopPropagation()
    instance.view.dom.addEventListener('keydown', stopPropagation)
    stopKeys = () => instance.view.dom.removeEventListener('keydown', stopPropagation)
    if (selectAll) instance.commands.selectAll()
    else {
      const clicked = point ? instance.view.posAtCoords({ left: point.x, top: point.y }) : null
      instance.commands.setTextSelection(clicked?.pos ?? instance.state.doc.content.size - 1)
    }
    instance.commands.focus(undefined, { scrollIntoView: false })
    return true
  }

  async function apply(html?: string, source = textSource.value, label = action('actionEditText')) {
    if (!source) return
    if (html === undefined) {
      if (!editor.value || !originalDoc || originalDoc.eq(editor.value.state.doc)) return
      html = editor.value.getHTML()
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
    const active = editor.value
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

  function undo() { editor.value?.commands.undo(); editor.value?.commands.focus(undefined, { scrollIntoView: false }) }
  function redo() { editor.value?.commands.redo(); editor.value?.commands.focus(undefined, { scrollIntoView: false }) }
  onScopeDispose(stop)
  return {
    editor, supported, format, scope, canUndo, canRedo, start, stop, run, apply, undo, redo,
    draft: () => editor.value && textSource.value ? writeEditableText(studio.content(), textSource.value, editor.value.getHTML()).block : null,
    html: () => editor.value?.getHTML() ?? '',
    changed: () => !!editor.value && !!originalDoc && !originalDoc.eq(editor.value.state.doc),
  }
}
