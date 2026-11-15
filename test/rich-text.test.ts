// @vitest-environment jsdom
import { afterEach, expect, it } from 'vitest'
import { effectScope } from 'vue'
import { createTextEditor, applyTextCommand, prepareTextHTML, readTextFormat } from '../client/text/editor'
import { useTextEditor } from '../client/composables/useTextEditor'
import { editing, selection } from '../client/state'
import type { StudioTarget } from '../client/types'
import { readEditableText, writeEditableText } from '../client/text/source'

const editors: ReturnType<typeof createTextEditor>[] = []
function editor(html: string) {
  const result = createTextEditor(html)
  editors.push(result)
  return result
}
const scopes: ReturnType<typeof effectScope>[] = []
afterEach(() => {
  scopes.splice(0).forEach(scope => scope.stop())
  editors.splice(0).forEach(value => value.destroy())
  selection.value = null
  editing.value = false
  document.body.replaceChildren()
})
function rendered(html: string) {
  const el = document.createElement('div')
  el.innerHTML = html
  return el
}

it('removes bold only from the selected words and supports undo and redo', () => {
  const e = editor('<p><strong>hello world</strong></p>')
  e.commands.setTextSelection({ from: 1, to: 6 })
  applyTextCommand(e, 'bold')
  expect(rendered(e.getHTML()).querySelector('strong')?.textContent).toBe(' world')
  e.commands.undo()
  expect(rendered(e.getHTML()).querySelector('strong')?.textContent).toBe('hello world')
  e.commands.redo()
  expect(rendered(e.getHTML()).querySelector('strong')?.textContent).toBe(' world')
})

it('sets the format of subsequent typing at a caret without changing adjacent text', () => {
  const e = editor('<p>ab</p>')
  e.commands.setTextSelection(2)
  applyTextCommand(e, 'bold')
  e.commands.insertContent('X')
  const result = rendered(e.getHTML())
  expect(result.textContent).toBe('aXb')
  expect(result.querySelector('strong')?.textContent).toBe('X')
})

it('reports mixed text formatting and applies a whole-box size without flattening colours', () => {
  const e = editor('<p><span style="font-size:40px;color:red">abc</span>def</p>')
  e.commands.selectAll()
  expect(readTextFormat(e.state).fontSize).toBeNull()
  expect(readTextFormat(e.state).color).toBeNull()
  applyTextCommand(e, 'fontSize', '32')
  expect(readTextFormat(e.state).fontSize).toBe(32)
  expect(readTextFormat(e.state).color).toBeNull()
  expect(e.getText()).toBe('abcdef')
})

it('can turn off inherited bold for a selection while keeping the text-box default', () => {
  const e = editor('<p>hello world</p>')
  e.commands.setTextSelection({ from: 1, to: 6 })
  expect(readTextFormat(e.state, { bold: true }).bold).toBe(true)
  applyTextCommand(e, 'bold', undefined, { bold: true })
  const span = rendered(e.getHTML()).querySelector('span')!
  expect(span.textContent).toBe('hello')
  expect(span.style.fontWeight).toBe('normal')
  expect(readTextFormat(e.state, { bold: true }).bold).toBe(false)
})

it('round-trips paragraph alignment, line spacing and list structure as standalone HTML', () => {
  const e = editor('<p>one</p><p>two</p>')
  e.commands.selectAll()
  applyTextCommand(e, 'align', 'center')
  applyTextCommand(e, 'lineHeight', '1.5')
  applyTextCommand(e, 'bulletList')
  const html = e.getHTML()
  const result = rendered(html)
  expect(result.querySelectorAll('li')).toHaveLength(2)
  expect(result.querySelector('p')?.style.textAlign).toBe('center')
  expect(result.querySelector('p')?.style.lineHeight).toBe('1.5')
  const reopened = editor(html)
  reopened.commands.selectAll()
  expect(readTextFormat(reopened.state)).toMatchObject({ align: 'center', lineHeight: '1.5', bulletList: true })
})

it('normalises old div lines without losing line breaks or inline marks', () => {
  const e = editor('first<div><b>second</b><br>third</div>')
  const result = rendered(e.getHTML())
  expect(result.querySelectorAll('p')).toHaveLength(2)
  expect(result.querySelector('strong')?.textContent).toBe('second')
  expect(result.querySelectorAll('br')).toHaveLength(1)
  expect(result.textContent).toBe('firstsecondthird')
})

it('refuses source HTML that the editor would silently discard', () => {
  expect(prepareTextHTML('<span class="custom">styled</span>')).toBeNull()
  expect(prepareTextHTML('<span :style="userStyle">dynamic</span>')).toBeNull()
  expect(prepareTextHTML('<p>{{ dynamicTitle }}</p>')).toBeNull()
  expect(prepareTextHTML('<span style="letter-spacing:5px">spaced</span>')).toBeNull()
  expect(prepareTextHTML('<Widget>custom</Widget>')).toBeNull()
  expect(prepareTextHTML('<span style="font-size:2em">a<span style="font-size:2em">b</span></span>')).toBeNull()
  expect(prepareTextHTML('<ul style="margin:0 0 0 3em"><li>indented</li></ul>')).toBeNull()
  expect(prepareTextHTML('<span style="font-size:24px;color:red">supported</span>')).not.toBeNull()
})

function textbox(inner: string) {
  let source = `<div data-studio-element="text" v-drag="[10,20,300,NaN]" style="font-size:28px;color:black">${inner}</div>`
  const root = rendered(source).firstElementChild as HTMLElement
  document.body.append(root)
  selection.value = { el: root, no: 1, range: [0, 1], kind: 'html', tag: 'div', element: 'text', positioned: true, nested: false, label: 'Text' }
  const scope = effectScope()
  scopes.push(scope)
  const text = scope.run(() => useTextEditor({ content: () => source, commit: async next => { source = next } }))!
  return { root, text, source: () => source }
}

it('keeps the text range after a toolbar field takes focus, with draft changes in the editor history', async () => {
  const s = textbox('<p>hello world</p>')
  const source = s.source()
  editing.value = true
  s.text.start(selection.value!, '<p>hello world</p>', false, () => {})
  const e = s.text.editor.value!
  expect(s.text.changed()).toBe(false)
  e.commands.setTextSelection({ from: 1, to: 6 })
  const field = document.createElement('input')
  document.body.append(field)
  field.focus()
  await s.text.run('fontSize', '40')
  const span = rendered(s.text.html()).querySelector('span')!
  expect(span.textContent).toBe('hello')
  expect(span.style.fontSize).toBe('40px')
  expect(s.source()).toBe(source)
  expect(s.text.changed()).toBe(true)
  s.text.undo()
  expect(s.text.changed()).toBe(false)
})

it('formats all text in a selected box while preserving its position and existing defaults', async () => {
  const s = textbox('<p>one <strong>two</strong></p>')
  await s.text.run('fontSize', '36')
  const result = rendered(s.source()).firstElementChild as HTMLElement
  expect(result.getAttribute('v-drag')).toBe('[10,20,300,NaN]')
  expect(result.style.fontSize).toBe('28px')
  expect(result.querySelector('strong')?.textContent).toBe('two')
  expect([...result.querySelectorAll('span')].every(span => span.style.fontSize === '36px')).toBe(true)
  expect(s.text.editor.value).toBeNull()
})

it('checks authored markup even when Vue has rendered away its directives', async () => {
  const s = textbox('<span :style="customStyle">custom</span>')
  const source = s.source()
  s.root.innerHTML = '<span>custom</span>'
  expect(s.text.supported.value).toBe(false)
  await s.text.run('fontSize', '36')
  expect(s.source()).toBe(source)
})

function nativeTarget(source: string, tag: string, inner: string, kind: StudioTarget['kind'] = 'heading'): StudioTarget {
  const el = document.createElement(tag)
  el.innerHTML = inner
  document.body.append(el)
  return { el, no: 1, range: [0, source.split('\n').length], kind, tag: kind === 'html' ? tag : undefined, positioned: false, nested: false, label: tag }
}

it('writes partial heading size as semantic HTML and leaves adjacent source intact', () => {
  const source = '# Hello world\n\nLeave this paragraph alone.'
  const target = nativeTarget('# Hello world', 'h1', 'Hello world')
  const text = readEditableText(source, target)!
  const e = editor(text.html)
  e.commands.setTextSelection({ from: 1, to: 6 })
  applyTextCommand(e, 'fontSize', '42')
  const result = writeEditableText(source, text, e.getHTML())
  const root = rendered(result.content.split('\n\n')[0]).firstElementChild as HTMLElement
  expect(root.tagName).toBe('H1')
  expect(root.querySelector('span')?.textContent).toBe('Hello')
  expect((root.querySelector('span') as HTMLElement).style.fontSize).toBe('42px')
  expect(root.textContent).toBe('Hello world')
  expect(result.content.endsWith('\n\nLeave this paragraph alone.')).toBe(true)
  expect(root.hasAttribute('data-studio-element')).toBe(false)
  expect(result.tag).toBe('h1')
  expect(result.range).toEqual([0, 1])
  expect(readEditableText(result.content, { ...target, el: root, kind: 'html', tag: 'h1', range: result.range })).not.toBeNull()
})

it('keeps heading Markdown when a character mark can be represented without HTML', () => {
  const source = '## Hello world'
  const text = readEditableText(source, nativeTarget(source, 'h2', 'Hello world'))!
  const e = editor(text.html)
  e.commands.setTextSelection({ from: 1, to: 6 })
  applyTextCommand(e, 'bold')
  expect(writeEditableText(source, text, e.getHTML()).content).toBe('## **Hello** world')
})

it('preserves literal text and paragraph semantics when Markdown would interpret newly typed syntax', () => {
  const source = 'Original paragraph'
  const text = readEditableText(source, nativeTarget(source, 'p', source, 'paragraph'))!
  for (const literal of ['# literal', '- literal', '1. literal', '<b>x</b>', 'Hello &copy;', '---']) {
    const p = document.createElement('p')
    p.textContent = literal
    const e = editor(p.outerHTML)
    const result = rendered(writeEditableText(source, text, e.getHTML()).content).firstElementChild!
    expect(result.tagName).toBe('P')
    expect(result.textContent).toBe(literal)
  }
  const heading = '# Original'
  const title = readEditableText(heading, nativeTarget(heading, 'h1', 'Original'))!
  const result = rendered(writeEditableText(heading, title, '<p>Keep this #</p>').content).firstElementChild!
  expect(result.tagName).toBe('H1')
  expect(result.textContent).toBe('Keep this #')
})

it('retains authored heading attributes and root styles when applying paragraph format', () => {
  const source = '<h2 class="hero" id="title" v-drag="[10,20,500,NaN]" v-click style="margin-top:20px;color:navy">Hello world</h2>'
  const target = nativeTarget(source, 'h2', 'Hello world', 'html')
  const text = readEditableText(source, target)!
  const e = editor(text.html)
  e.commands.selectAll()
  applyTextCommand(e, 'align', 'center')
  applyTextCommand(e, 'lineHeight', '1.5')
  const result = writeEditableText(source, text, e.getHTML())
  const root = rendered(result.content).firstElementChild as HTMLElement
  expect(root.tagName).toBe('H2')
  expect(root.className).toBe('hero')
  expect(root.id).toBe('title')
  expect(root.getAttribute('v-drag')).toBe('[10,20,500,NaN]')
  expect(root.hasAttribute('v-click')).toBe(true)
  expect(root.style.marginTop).toBe('20px')
  expect(root.style.color).toBe('navy')
  expect(root.style.textAlign).toBe('center')
  expect(root.style.lineHeight).toBe('1.5')
})

it('writes new heading paragraphs as sibling blocks and keeps generated lists editable', () => {
  const source = '# Hello'
  const text = readEditableText(source, nativeTarget(source, 'h1', 'Hello'))!
  const result = writeEditableText(source, text, '<p>Hello</p><p>Next paragraph</p>')
  const blocks = [...rendered(result.content).children]
  expect(blocks.map(el => el.tagName)).toEqual(['H1', 'P'])
  expect(blocks.map(el => el.textContent)).toEqual(['Hello', 'Next paragraph'])

  const paragraph = 'A paragraph'
  const plain = readEditableText(paragraph, nativeTarget(paragraph, 'p', paragraph, 'paragraph'))!
  const e = editor(plain.html)
  e.commands.selectAll()
  applyTextCommand(e, 'bulletList')
  const listed = writeEditableText(paragraph, plain, e.getHTML())
  const list = rendered(listed.content).firstElementChild as HTMLElement
  expect(list.tagName).toBe('UL')
  expect(list.querySelector('li')?.textContent).toBe(paragraph)
  expect(readEditableText(listed.content, { ...nativeTarget(listed.content, 'ul', list.innerHTML, 'html'), el: list })).not.toBeNull()
})

it('does not use rendered text to overwrite template expressions or custom authored inner markup', () => {
  const template = '# Hello {{ name }}'
  expect(readEditableText(template, nativeTarget(template, 'h1', 'Hello Alice'))).toBeNull()
  const bound = '<h1><span :style="customStyle">Hello</span></h1>'
  expect(readEditableText(bound, nativeTarget(bound, 'h1', '<span>Hello</span>', 'html'))).toBeNull()
  const nested = nativeTarget('<div><h1>Hello</h1></div>', 'h1', 'Hello', 'html')
  expect(readEditableText('<div><h1>Hello</h1></div>', { ...nested, nested: true })).toBeNull()
})

it('shares the active editor with a Markdown heading without rewriting an unchanged edit', async () => {
  let source = '# Hello world'
  const target = nativeTarget(source, 'h1', 'Hello world')
  selection.value = target
  const scope = effectScope()
  scopes.push(scope)
  const text = scope.run(() => useTextEditor({ content: () => source, commit: async next => { source = next } }))!
  expect(text.supported.value).toBe(true)
  editing.value = true
  expect(text.start(target, readEditableText(source, target)!.html, false, () => {})).toBe(true)
  expect(text.changed()).toBe(false)
  await text.apply()
  expect(source).toBe('# Hello world')
  text.editor.value!.commands.setTextSelection({ from: 1, to: 6 })
  await text.run('color', '#ff0000')
  expect(source).toBe('# Hello world')
  text.undo()
  expect(text.changed()).toBe(false)
  text.redo()
  expect(rendered(text.draft()!).querySelector('h1 span')?.textContent).toBe('Hello')
  await text.apply()
  expect(rendered(source).querySelector('h1 span')?.textContent).toBe('Hello')
})

it('applies whole-block toolbar formatting to an ordinary paragraph without positioning it', async () => {
  let source = 'Hello **world**\n\nOther paragraph'
  const target = nativeTarget('Hello **world**', 'p', 'Hello <strong>world</strong>', 'paragraph')
  selection.value = target
  const scope = effectScope()
  scopes.push(scope)
  const text = scope.run(() => useTextEditor({ content: () => source, commit: async next => { source = next } }))!
  await text.run('fontSize', '24')
  const first = rendered(source.split('\n\n')[0]).firstElementChild as HTMLElement
  expect(first.tagName).toBe('P')
  expect(first.querySelector('strong')?.textContent).toBe('world')
  expect([...first.querySelectorAll('span')].every(span => span.style.fontSize === '24px')).toBe(true)
  expect(first.hasAttribute('v-drag')).toBe(false)
  expect(source.endsWith('\n\nOther paragraph')).toBe(true)
  expect(text.editor.value).toBeNull()
})

it('reopens native paragraph indentation and can remove it without replacing unrelated root styles', () => {
  const source = '<p class="body" style="color:navy;margin-left:1.5em">Hello</p>'
  const text = readEditableText(source, nativeTarget(source, 'p', 'Hello', 'html'))!
  const e = editor(text.html)
  e.commands.selectAll()
  applyTextCommand(e, 'outdent')
  const result = rendered(writeEditableText(source, text, e.getHTML()).content).firstElementChild as HTMLElement
  expect(result.style.marginLeft).toBe('')
  expect(result.style.color).toBe('navy')
  expect(result.className).toBe('body')
})

it('selects a whole word across character marks, including Chinese words', async () => {
  const { selectTextWord } = await import('../client/text/editor')
  const e = editor('<p>he<strong>llo</strong> world</p><p>编辑文字</p>')
  selectTextWord(e, 4)
  expect(e.state.doc.textBetween(e.state.selection.from, e.state.selection.to)).toBe('hello')
  selectTextWord(e, 14)
  expect(e.state.doc.textBetween(e.state.selection.from, e.state.selection.to)).toBe('编辑')
})

it('round-trips paragraph spacing and changes only selected paragraphs', () => {
  const e = editor('<p>one</p><p>two</p>')
  e.commands.setTextSelection(2)
  applyTextCommand(e, 'spaceBefore', '12')
  applyTextCommand(e, 'spaceAfter', '8')
  const html = e.getHTML()
  const ps = rendered(html).querySelectorAll('p')
  expect(ps[0].style.marginTop).toBe('12px')
  expect(ps[0].style.marginBottom).toBe('8px')
  expect(ps[1].style.marginTop).toBe('0px')
  const reopened = editor(html)
  reopened.commands.setTextSelection(2)
  expect(readTextFormat(reopened.state)).toMatchObject({ spaceBefore: 12, spaceAfter: 8 })
})

it('opens an ordinary Markdown list and preserves its items when formatting it', () => {
  const source = '- one\n- two'
  const target = nativeTarget(source, 'ul', '<li>one</li><li>two</li>', 'list')
  const read = readEditableText(source, target)!
  expect(read).not.toBeNull()
  const e = editor(read.html)
  e.commands.selectAll()
  applyTextCommand(e, 'fontSize', '32')
  const result = writeEditableText(source, read, e.getHTML())
  const list = rendered(result.content).querySelector('ul')!
  expect([...list.querySelectorAll('li')].map(li => li.textContent)).toEqual(['one', 'two'])
  expect(readEditableText(result.content, nativeTarget(result.content, 'ul', list.innerHTML, 'html'))).not.toBeNull()
})

it('pastes plain text literally with line breaks and optional destination marks', async () => {
  const { pasteText } = await import('../client/text/editor')
  const e = editor('<p><strong>hello</strong></p>')
  e.commands.setTextSelection(3)
  pasteText(e, 'X\nY', true)
  expect([...rendered(e.getHTML()).querySelectorAll('p')].map(p => p.textContent)).toEqual(['heX', 'Yllo'])
  e.commands.undo()
  e.commands.setTextSelection(6)
  pasteText(e, '<b>X</b>\nY', true)
  expect(e.getText()).toContain('<b>X</b>')
  expect([...rendered(e.getHTML()).querySelectorAll('strong')].map(n => n.textContent).join('')).toContain('<b>X</b>')
  e.commands.selectAll()
  pasteText(e, 'plain', false)
  expect(rendered(e.getHTML()).querySelector('strong')).toBeNull()
  expect(e.getText()).toBe('plain')
})


it('clears native paragraph spacing inherited from a margin shorthand', () => {
  const source = '<p style="margin:12px;color:navy">one</p>'
  const read = readEditableText(source, nativeTarget(source, 'p', 'one', 'html'))!
  const e = editor(read.html)
  e.commands.selectAll()
  applyTextCommand(e, 'spaceBefore', '0')
  const result = rendered(writeEditableText(source, read, e.getHTML()).content).firstElementChild as HTMLElement
  expect(result.style.marginTop).toBe('0px')
  expect(result.style.marginBottom).toBe('12px')
  expect(result.style.color).toBe('navy')
})

it('formats the mapped Markdown list when a list item is selected', () => {
  const source = '- one\n- two'
  const target = nativeTarget(source, 'ul', '<li>one</li><li>two</li>', 'list')
  target.el.dataset.studioKind = 'list'
  target.el.dataset.studioSrc = '0,2'
  const item = { ...target, el: target.el.children[1] as HTMLElement, kind: 'list-item' as const, range: [1, 2] as [number, number] }
  expect(readEditableText(source, item)?.range).toEqual([0, 2])
})


it('saves a single Markdown list item as a paragraph after toggling the list off', () => {
  const source = '- one'
  const read = readEditableText(source, nativeTarget(source, 'ul', '<li>one</li>', 'list'))!
  const e = editor(read.html)
  e.commands.selectAll()
  applyTextCommand(e, 'bulletList')
  expect(writeEditableText(source, read, e.getHTML()).content).toBe('one')
})
