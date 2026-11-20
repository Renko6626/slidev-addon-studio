import { Editor, Extension } from '@tiptap/core'
import type { EditorOptions } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import { Color, FontFamily, FontSize, TextStyle } from '@tiptap/extension-text-style'
import TextAlign from '@tiptap/extension-text-align'
import { Fragment, Slice } from '@tiptap/pm/model'
import type { Mark, Node as TextNode } from '@tiptap/pm/model'
import type { EditorState } from '@tiptap/pm/state'
import { closeHistory } from '@tiptap/pm/history'

export type TextCommand = 'bold' | 'italic' | 'underline' | 'strike' | 'clear'
  | 'fontFamily' | 'fontSize' | 'color' | 'backgroundColor' | 'align' | 'lineHeight'
  | 'bulletList' | 'orderedList' | 'indent' | 'outdent' | 'spaceBefore' | 'spaceAfter'
  | 'link' | 'unlink'
type Toggle = boolean | 'mixed'
export interface TextDefaults {
  fontFamily?: string
  fontSize?: number
  color?: string
  bold?: boolean
  italic?: boolean
  underline?: boolean
  strike?: boolean
  align?: string
  lineHeight?: string
}
export interface TextFormat {
  fontFamily: string | null
  fontSize: number | null
  color: string | null
  backgroundColor: string | null
  link: string | null
  bold: Toggle
  italic: Toggle
  underline: Toggle
  strike: Toggle
  align: string | null
  lineHeight: string | null
  spaceBefore: number | null
  spaceAfter: number | null
  bulletList: Toggle
  orderedList: Toggle
}

const fontStyles = ['font-family', 'font-size', 'color', 'background-color', 'font-weight', 'font-style', 'text-decoration']
const inlineTags = new Set(['span', 'b', 'strong', 'i', 'em', 'u', 's', 'strike', 'del', 'code', 'a', 'br'])

/** Check the authored HTML, before a schema has a chance to discard attributes. */
export function prepareTextHTML(html: string, variant: 'block' | 'inline' = 'block'): string | null {
  if (variant === 'block' && html.includes('{{')) return null
  const root = document.createElement('div')
  root.innerHTML = html
  const walk = document.createTreeWalker(root, NodeFilter.SHOW_COMMENT)
  if (walk.nextNode()) return null
  for (const el of [...root.querySelectorAll<HTMLElement>('*')]) {
    const tag = el.tagName.toLowerCase()
    if (!inlineTags.has(tag) && !['div', 'p', 'ul', 'ol', 'li'].includes(tag)) return null
    for (const attr of [...el.attributes]) {
      if (attr.name === 'style') continue
      if (tag === 'a' && ['href', 'target', 'rel'].includes(attr.name)) continue
      if (tag === 'ol' && attr.name === 'start') continue
      return null
    }
    const keys = [...(el.getAttribute('style') ?? '').matchAll(/(?:^|;)\s*([\w-]+)\s*:/g)].map(match => match[1].toLowerCase())
    const allowed = tag === 'span' ? fontStyles
      : tag === 'p' || tag === 'div' ? [...fontStyles, 'text-align', 'line-height', 'margin', 'margin-left', 'margin-top', 'margin-bottom', 'min-height']
        : tag === 'ul' || tag === 'ol' ? ['margin', 'padding-left', 'list-style-type']
          : tag === 'li' ? ['margin'] : []
    if (keys.some(key => !allowed.includes(key))) return null
    // Only our own spacing defaults may be normalised on load.
    if (el.style.margin && (['p', 'div'].includes(tag) ? [el.style.marginRight] : [el.style.marginTop, el.style.marginRight, el.style.marginBottom]).some(value => value && !/^0(px)?$/.test(value))) return null
    if (['p', 'div'].includes(tag) && [el.style.marginTop, el.style.marginBottom].some(value => value && !/^(0|\d+(\.\d+)?px)$/.test(value))) return null
    if (el.style.paddingLeft && el.style.paddingLeft !== '1.5em') return null
    if (el.style.marginLeft && !/^(0(px)?|\d+(\.\d+)?em)$/.test(el.style.marginLeft)) return null
    if (['ul', 'ol', 'li'].includes(tag) && el.style.marginLeft && !/^0(px)?$/.test(el.style.marginLeft)) return null
    if (el.style.minHeight && el.style.minHeight !== '1lh') return null
    if (el.style.textDecoration && !/^(underline|line-through)( (underline|line-through))?$/.test(el.style.textDecoration)) return null
    if (el.style.listStyleType && el.style.listStyleType !== (tag === 'ol' ? 'decimal' : 'disc')) return null
    // Flattening nested spans would change a size relative to another sized span.
    if (el.style.fontSize && !/\d(px|pt|rem)$/.test(el.style.fontSize)) {
      for (let parent = el.parentElement; parent && parent !== root; parent = parent.parentElement)
        if (parent.style.fontSize) return null
    }
  }
  for (const el of [...root.querySelectorAll<HTMLElement>('div, p')].reverse()) {
    if (el.tagName === 'DIV') {
      if (el.querySelector('div, p, ul, ol')) {
        if (el.attributes.length) return null
        el.replaceWith(...el.childNodes)
        continue
      }
      const paragraph = document.createElement('p')
      paragraph.setAttribute('style', el.getAttribute('style') ?? '')
      paragraph.append(...el.childNodes)
      el.replaceWith(paragraph)
    }
  }
  // Paragraph-level font styles become marks, so partial editing preserves them.
  for (const p of root.querySelectorAll<HTMLElement>('p')) {
    const span = document.createElement('span')
    for (const key of fontStyles) {
      const value = p.style.getPropertyValue(key)
      if (value) span.style.setProperty(key, value)
      p.style.removeProperty(key)
    }
    if (span.getAttribute('style')) {
      span.append(...p.childNodes)
      p.append(span)
    }
  }
  return root.innerHTML
}

const StudioTextStyle = TextStyle.extend({
  addAttributes() {
    return Object.fromEntries([
      ['fontWeight', 'font-weight'], ['fontStyle', 'font-style'], ['backgroundColor', 'background-color'],
    ].map(([name, css]) => [name, {
      default: null,
      parseHTML: (element: HTMLElement) => element.style.getPropertyValue(css) || null,
      renderHTML: (attrs: Record<string, string>) => attrs[name] ? { style: `${css}:${attrs[name]}` } : {},
    }]))
  },
})

const ParagraphFormat = Extension.create({
  name: 'studioParagraphFormat',
  addGlobalAttributes() {
    return [{ types: ['paragraph'], attributes: {
      lineHeight: {
        default: null,
        parseHTML: (el: HTMLElement) => el.style.lineHeight || null,
        renderHTML: (attrs: Record<string, string>) => attrs.lineHeight ? { style: `line-height:${attrs.lineHeight}` } : {},
      },
      ...Object.fromEntries([['spaceBefore', 'margin-top'], ['spaceAfter', 'margin-bottom']].map(([name, css]) => [name, {
        default: null,
        parseHTML: (el: HTMLElement) => el.style.getPropertyValue(css) || null,
        renderHTML: (attrs: Record<string, string>) => attrs[name] ? { style: `${css}:${attrs[name]}` } : {},
      }])),
      indent: {
        default: 0,
        parseHTML: (el: HTMLElement) => Number.parseFloat(el.style.marginLeft) / 1.5 || 0,
        renderHTML: (attrs: Record<string, number>) => attrs.indent ? { style: `margin-left:${attrs.indent * 1.5}em` } : {},
      },
    } }]
  },
  addKeyboardShortcuts() {
    return {
      Tab: () => this.editor.isActive('listItem') && this.editor.commands.sinkListItem('listItem'),
      'Shift-Tab': () => this.editor.isActive('listItem') && this.editor.commands.liftListItem('listItem'),
    }
  },
})

export function createTextEditor(html: string, options: Partial<EditorOptions> = {}, variant: 'block' | 'inline' = 'block'): Editor {
  const content = prepareTextHTML(html, variant)
  if (content === null) throw new Error('Unsupported text-box HTML')
  return new Editor({
    element: document.createElement('div'),
    injectCSS: false,
    enableInputRules: false,
    enablePasteRules: false,
    parseOptions: { preserveWhitespace: 'full' },
    extensions: [
      StarterKit.configure({
        heading: false, blockquote: false, codeBlock: false, horizontalRule: false,
        dropcursor: false, gapcursor: false, trailingNode: false,
        paragraph: { HTMLAttributes: { style: 'margin:0;min-height:1lh' } },
        ...(variant === 'inline'
          ? { bulletList: false, orderedList: false, listItem: false }
          : {
              bulletList: { HTMLAttributes: { style: 'margin:0;padding-left:1.5em;list-style-type:disc' }, keepMarks: true },
              orderedList: { HTMLAttributes: { style: 'margin:0;padding-left:1.5em;list-style-type:decimal' }, keepMarks: true },
              listItem: { HTMLAttributes: { style: 'margin:0' } },
            }),
        link: { openOnClick: false, autolink: false, HTMLAttributes: { target: null, rel: null, class: null } },
      }),
      StudioTextStyle, Color, FontFamily, FontSize,
      TextAlign.configure({ types: ['paragraph'] }), ParagraphFormat,
    ],
    content,
    ...options,
  })
}

function common<T>(values: T[]): T | null {
  return values.length && values.every(value => value === values[0]) ? values[0] : null
}
function toggle(values: boolean[]): Toggle { return common(values) ?? 'mixed' }

function fontPixels(value: string | undefined, base: number): number {
  if (!value) return base
  const n = Number.parseFloat(value)
  if (!Number.isFinite(n)) return base
  if (value.endsWith('pt')) return Math.round(n * 4 / 3 * 100) / 100
  if (value.endsWith('%')) return n * base / 100
  if (value.endsWith('rem')) return n * (Number.parseFloat(getComputedStyle(document.documentElement).fontSize) || 16)
  if (value.endsWith('em')) return n * base
  return n
}

function paragraphs(state: EditorState): { node: TextNode, pos: number, list: string }[] {
  const result: { node: TextNode, pos: number, list: string }[] = []
  const { from, to, $from, empty } = state.selection
  function add(node: TextNode, pos: number) {
    const at = state.doc.resolve(pos + 1)
    let list = ''
    for (let depth = at.depth; depth > 0; depth--) {
      const type = at.node(depth).type.name
      if (type === 'bulletList' || type === 'orderedList') { list = type; break }
    }
    result.push({ node, pos, list })
  }
  if (empty) {
    if ($from.parent.type.name === 'paragraph') add($from.parent, $from.before())
  }
  else state.doc.nodesBetween(from, to, (node, pos) => { if (node.type.name === 'paragraph') add(node, pos) })
  return result
}

export function readTextFormat(state: EditorState, defaults: TextDefaults = {}): TextFormat {
  const marks: (readonly Mark[])[] = []
  const { from, to, empty, $from } = state.selection
  if (empty) marks.push(state.storedMarks ?? $from.marks())
  else state.doc.nodesBetween(from, to, node => { if (node.isText) marks.push(node.marks) })
  if (!marks.length) marks.push([])
  const styles = marks.map(run => run.find(mark => mark.type.name === 'textStyle')?.attrs ?? {})
  const has = (name: string, index: number) => marks[index].some(mark => mark.type.name === name)
  const ps = paragraphs(state)
  return {
    fontFamily: common(styles.map(style => String(style.fontFamily || defaults.fontFamily || 'sans-serif').replace(/["']/g, ''))),
    fontSize: common(styles.map(style => fontPixels(style.fontSize, defaults.fontSize ?? 28))),
    color: common(styles.map(style => style.color || defaults.color || '#000000')),
    backgroundColor: common(styles.map(style => String(style.backgroundColor || ''))) || null,
    link: common(marks.map(run => String(run.find(mark => mark.type.name === 'link')?.attrs.href || ''))) || null,
    bold: toggle(styles.map((style, i) => has('bold', i) || (style.fontWeight ? /^(bold|[6-9]00)$/.test(style.fontWeight) : !!defaults.bold))),
    italic: toggle(styles.map((style, i) => has('italic', i) || (style.fontStyle ? style.fontStyle === 'italic' : !!defaults.italic))),
    underline: toggle(styles.map((style, i) => has('underline', i) || (style.textDecoration ? style.textDecoration.includes('underline') : !!defaults.underline))),
    strike: toggle(styles.map((style, i) => has('strike', i) || (style.textDecoration ? style.textDecoration.includes('line-through') : !!defaults.strike))),
    align: common(ps.map(p => p.node.attrs.textAlign || defaults.align || 'left')),
    lineHeight: common(ps.map(p => p.node.attrs.lineHeight || defaults.lineHeight || '1.3')),
    spaceBefore: common(ps.map(p => Number.parseFloat(p.node.attrs.spaceBefore) || 0)),
    spaceAfter: common(ps.map(p => Number.parseFloat(p.node.attrs.spaceAfter) || 0)),
    bulletList: toggle(ps.map(p => p.list === 'bulletList')),
    orderedList: toggle(ps.map(p => p.list === 'orderedList')),
  }
}

/** A single format command is a single undo step, separate from nearby typing. */
export function applyTextCommand(editor: Editor, command: TextCommand, value?: string, defaults: TextDefaults = {}): boolean {
  const state = readTextFormat(editor.state, defaults)
  editor.view.dispatch(closeHistory(editor.state.tr))
  let result = false
  switch (command) {
    case 'bold': result = state.bold === true
      ? editor.chain().unsetBold().setMark('textStyle', { fontWeight: 'normal' }).run()
      : editor.chain().setMark('textStyle', { fontWeight: null }).setBold().run(); break
    case 'italic': result = state.italic === true
      ? editor.chain().unsetItalic().setMark('textStyle', { fontStyle: 'normal' }).run()
      : editor.chain().setMark('textStyle', { fontStyle: null }).setItalic().run(); break
    case 'underline': result = editor.commands.toggleUnderline(); break
    case 'strike': result = editor.commands.toggleStrike(); break
    case 'clear': result = editor.commands.unsetAllMarks(); break
    case 'fontFamily': if (value?.trim()) result = editor.commands.setFontFamily(value.trim()); break
    case 'fontSize': {
      const size = Number(value)
      if (value?.trim() && Number.isFinite(size)) result = editor.commands.setFontSize(`${Math.max(8, Math.min(200, size))}px`)
      break
    }
    case 'color': if (value?.trim()) result = editor.commands.setColor(value.trim()); break
    case 'backgroundColor': result = editor.chain().setMark('textStyle', { backgroundColor: value?.trim() || null }).run(); break
    case 'link':
      result = value?.trim()
        ? editor.chain().setLink({ href: value.trim() }).run()
        : editor.chain().unsetLink().run()
      break
    case 'unlink': result = editor.chain().unsetLink().run(); break
    case 'align': if (value) result = editor.commands.setTextAlign(value); break
    case 'lineHeight': if (value && Number(value) > 0 && Number(value) <= 10) result = editor.commands.updateAttributes('paragraph', { lineHeight: value }); break
    case 'spaceBefore': case 'spaceAfter': {
      const n = Number(value)
      if (value?.trim() && Number.isFinite(n) && n >= 0 && n <= 200)
        result = editor.commands.updateAttributes('paragraph', { [command]: `${n}px` })
      break
    }
    case 'bulletList': result = editor.commands.toggleBulletList(); break
    case 'orderedList': result = editor.commands.toggleOrderedList(); break
    case 'indent': case 'outdent': {
      if (editor.isActive('listItem')) result = command === 'indent'
        ? editor.commands.sinkListItem('listItem') : editor.commands.liftListItem('listItem')
      else {
        const tr = editor.state.tr
        for (const { node, pos } of paragraphs(editor.state))
          tr.setNodeMarkup(pos, undefined, { ...node.attrs, indent: Math.max(0, Math.min(8, node.attrs.indent + (command === 'indent' ? 1 : -1))) })
        editor.view.dispatch(tr)
        result = true
      }
      break
    }
  }
  editor.view.dispatch(closeHistory(editor.state.tr))
  return result
}

/** Segment the clicked paragraph so marks do not split words. */
export function selectTextWord(editor: Editor, pos: number) {
  const at = editor.state.doc.resolve(pos)
  if (!at.parent.isTextblock) return
  const text = at.parent.textBetween(0, at.parent.content.size, '', '\n')
  const offset = Math.min(at.parentOffset, Math.max(0, text.length - 1))
  for (const part of new Intl.Segmenter(undefined, { granularity: 'word' }).segment(text)) {
    if (part.index <= offset && offset < part.index + part.segment.length) {
      if (part.isWordLike) editor.commands.setTextSelection({ from: at.start() + part.index, to: at.start() + part.index + part.segment.length })
      return
    }
  }
}

/** Clipboard text is inserted as nodes, never interpreted as HTML. */
export function pasteText(editor: Editor, text: string, matchFormat: boolean) {
  const { state } = editor
  const marks = matchFormat ? state.storedMarks ?? state.selection.$from.marks() : []
  const content = text.replace(/\r\n?/g, '\n').split('\n').map(line =>
    state.schema.nodes.paragraph.create(null, line ? state.schema.text(line, marks) : null))
  editor.view.dispatch(state.tr.replaceSelection(new Slice(Fragment.fromArray(content), 1, 1)).scrollIntoView())
  return true
}
