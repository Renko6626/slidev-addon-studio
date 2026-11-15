import type { SourceRange, StudioTarget } from '../types'
import type { BlockShape } from '../md/inline'
import { blockShape, canEditVisually, serialiseInline } from '../md/inline'
import { readTextContent, replaceTextContent } from '../md/elements'
import { getBlock, replaceBlock } from '../md/lines'
import { findAttr, opensWithTag, writeAttr } from '../md/tags'
import { prepareTextHTML } from './editor'

const PARAGRAPH_STYLES = ['text-align', 'line-height', 'margin-left']
const NATIVE_TAG = /^(h[1-6]|p|ul|ol)$/

export interface EditableTextSource {
  kind: 'box' | 'native'
  range: SourceRange
  html: string
  tag: string
  opening: string
  closing: string
  markdown?: BlockShape
  /** Root paragraph styles which were handed to the editor, not theme CSS. */
  paragraphStyles: Record<string, string>
}

export interface TextReplacement { content: string, block: string, range: SourceRange, tag?: string }

/** Read authored HTML directly; rendered components cannot stand in for source. */
export function readEditableText(content: string, target: StudioTarget): EditableTextSource | null {
  if (!target.range || target.nested || target.prop) return null
  const range: SourceRange = [...target.range]
  if (target.element === 'text') {
    const html = readTextContent(content, range)
    return html !== null && prepareTextHTML(html) !== null
      ? { kind: 'box', range, html, tag: 'div', opening: '', closing: '', paragraphStyles: {} } : null
  }
  const block = getBlock(content, range)
  if (block.includes('{{')) return null
  const opening = opensWithTag(block)
  if (opening) {
    const tag = opening.name.toLowerCase()
    if (target.kind !== 'html' || !NATIVE_TAG.test(tag) || tag !== target.el.tagName.toLowerCase()) return null
    const end = new RegExp(`</${tag}\\s*>\\s*$`, 'i').exec(block)
    if (!end || end.index < opening.end) return null
    const inner = block.slice(opening.end, end.index)
    const body = document.createElement('div')
    body.innerHTML = inner
    if (tag !== 'ul' && tag !== 'ol' && body.querySelector('p,div,ul,ol,li')) return null
    const outer = document.createElement('div')
    outer.innerHTML = block.slice(0, opening.end) + `</${tag}>`
    const root = outer.firstElementChild as HTMLElement
    const styles: Record<string, string> = {}
    for (const key of tag === 'ul' || tag === 'ol' ? [] : PARAGRAPH_STYLES) {
      const value = root.style.getPropertyValue(key)
      if (value && (key !== 'margin-left' || /^(0(px)?|\d+(\.\d+)?em)$/.test(value))) styles[key] = value
    }
    const editorRoot = document.createElement(tag === 'ul' || tag === 'ol' ? tag : 'p')
    for (const [key, value] of Object.entries(styles)) editorRoot.style.setProperty(key, value)
    if (tag === 'ol' && root.hasAttribute('start')) editorRoot.setAttribute('start', root.getAttribute('start')!)
    editorRoot.innerHTML = inner
    const html = editorRoot.outerHTML
    if (prepareTextHTML(html) === null) return null
    return { kind: 'native', range, html, tag, opening: block.slice(0, opening.end), closing: block.slice(end.index), paragraphStyles: styles }
  }
  if (target.kind !== 'heading' && target.kind !== 'paragraph') return null
  const shape = blockShape(block)
  if (!shape || (shape.kind !== 'heading' && shape.kind !== 'paragraph')) return null
  if (!canEditVisually(block, target.el, shape)) return null
  const tag = shape.kind === 'heading' ? `h${shape.prefix.trim().length}` : 'p'
  if (tag !== target.el.tagName.toLowerCase()) return null
  const copy = target.el.cloneNode(true) as HTMLElement
  for (const el of [copy, ...copy.querySelectorAll('*')])
    for (const attr of [...el.attributes]) if (attr.name.startsWith('data-studio-')) el.removeAttribute(attr.name)
  const html = `<p>${copy.innerHTML}</p>`
  if (prepareTextHTML(html) === null) return null
  return { kind: 'native', range, html, tag, opening: `<${tag}>`, closing: `</${tag}>`, markdown: shape, paragraphStyles: {} }
}

function rootOpening(source: EditableTextSource, node: HTMLElement, tag: string) {
  let opening = source.opening.replace(/<([a-z][\w-]*)/i, `<${tag}`)
  let style = findAttr(opening, 'style')?.value ?? ''
  let changed = false
  const list = tag === 'ul' || tag === 'ol'
  const keys = list && tag !== source.tag ? [...PARAGRAPH_STYLES, 'list-style-type', 'padding-left'] : PARAGRAPH_STYLES
  for (const key of keys) {
    const value = paragraphValue(node, key)
    if (!value && !source.paragraphStyles[key]) continue
    const pattern = new RegExp(`(^|;)\\s*${key}\\s*:[^;]*`, 'i')
    style = pattern.test(style)
      ? style.replace(pattern, (_, separator) => value ? `${separator}${key}:${value}` : separator)
      : style + `${style && !style.endsWith(';') ? ';' : ''}${key}:${value}`
    changed = true
  }
  if (!list && (source.tag === 'ul' || source.tag === 'ol')) {
    style = style.replace(/(^|;)\s*(list-style-type|padding-left)\s*:[^;]*/gi, '$1')
    changed = true
  }
  if (changed) opening = writeAttr(opening, 'style', style)
  if (tag === 'ul') opening = writeAttr(opening, 'start', null)
  if (tag === 'ol' && node.hasAttribute('start')) opening = writeAttr(opening, 'start', node.getAttribute('start')!)
  return opening
}

function paragraphValue(node: HTMLElement, key: string) {
  const value = node.style.getPropertyValue(key)
  // The editor's margin:0 shorthand also reports margin-left:0px. It is not
  // an authored indent and must not force plain Markdown into HTML.
  return key === 'margin-left' && /^0(px)?$/.test(value) ? '' : value
}

/** Write only the selected block. Multiple editor paragraphs become siblings. */
export function writeEditableText(content: string, source: EditableTextSource, html: string): TextReplacement {
  if (source.kind === 'box') {
    const next = replaceTextContent(content, source.range, html)
    const previous = readTextContent(content, source.range) ?? ''
    const range: SourceRange = [source.range[0], source.range[1] + html.split('\n').length - previous.split('\n').length]
    return { content: next, block: getBlock(next, range), range, tag: 'div' }
  }
  const root = document.createElement('div')
  root.innerHTML = html
  const nodes = [...root.children] as HTMLElement[]
  if (!nodes.length || nodes.some(node => !['P', 'UL', 'OL'].includes(node.tagName)))
    throw new Error('Unsupported rich-text block')
  const first = nodes[0]
  if (source.markdown && nodes.length === 1 && first.tagName === 'P'
    && !PARAGRAPH_STYLES.some(key => paragraphValue(first, key))) {
    const text = serialiseInline(first)
    // The inline writer escapes marks, but block markers, entities and literal
    // HTML can acquire new meaning in Markdown. Keep those as semantic HTML.
    const safe = text && !/[<>&#$\n]/.test(text)
      && (source.markdown.kind === 'heading' || !/^(?:[\s+*>`~:|=\-]|\d+[.)]\s)/.test(text))
    if (safe && !text.includes('{{')) {
      const written = source.markdown.prefix + text
      return { content: replaceBlock(content, source.range, written), block: written, range: [source.range[0], source.range[0] + written.split('\n').length] }
    }
  }
  const blocks = nodes.map((node, index) => {
    const tag = node.tagName === 'P' ? index === 0 && /^h[1-6]$/.test(source.tag) ? source.tag : 'p' : node.tagName.toLowerCase()
    if (index > 0) {
      if (node.tagName === 'P') {
        node.style.removeProperty('margin')
        node.style.removeProperty('min-height')
        if (!node.getAttribute('style')) node.removeAttribute('style')
      }
      return node.outerHTML
    }
    const opening = rootOpening(source, node, tag)
    const closing = tag === source.tag ? source.closing : `</${tag}>`
    return opening + node.innerHTML + closing
  })
  const written = blocks.join('\n\n').replace(/\{\{/g, '&#123;&#123;')
  const tag = opensWithTag(blocks[0])?.name
  return { content: replaceBlock(content, source.range, written), block: written, range: [source.range[0], source.range[0] + blocks[0].split('\n').length], tag }
}
