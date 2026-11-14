// @vitest-environment jsdom
import { afterEach, expect, it } from 'vitest'
import { effectScope } from 'vue'
import { createTextEditor, applyTextCommand, prepareTextHTML, readTextFormat } from '../client/text/editor'
import { useTextEditor } from '../client/composables/useTextEditor'
import { editing, selection } from '../client/state'

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
