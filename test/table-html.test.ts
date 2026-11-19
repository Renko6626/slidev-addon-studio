// @vitest-environment jsdom
import { expect, it } from 'vitest'
import { cellHTMLFromText, editorHTMLToCell, escapeCellText, flattenCellHTML, sanitiseCellHTML, validateCellHTML } from '../shared/table-html'

it('accepts the supported inline subset', () => {
  const html = '<strong>a</strong><em>b</em><u>c</u><s>d</s><code>e</code><a href="https://example.com" target="_blank" rel="noopener">f</a><span style="color: #ff0000; background-color: #ffff00; font-size: 20px">g</span><br>'
  expect(validateCellHTML(html)).toBe(true)
  expect(sanitiseCellHTML(html)).toContain('<strong>a</strong>')
  expect(sanitiseCellHTML(html)).toContain('background-color: #ffff00')
})

it('rejects markup the editor cannot preserve', () => {
  for (const html of [
    '<script>alert(1)</script>',
    '<div>x</div>',
    '<ul><li>x</li></ul>',
    '<span class="x">x</span>',
    '<span style="position: fixed">x</span>',
    '<a href="javascript:alert(1)">x</a>',
    '<!-- note -->',
    '<b style="color: red">x</b>',
  ])
    expect(validateCellHTML(html), html).toBe(false)
})

it('cleans unsupported markup for rendering', () => {
  const html = '<div>a<script>bad()</script><span onclick="x()" style="color: red; position: fixed">b</span></div>'
  const clean = sanitiseCellHTML(html)
  expect(clean).not.toContain('<script')
  expect(clean).not.toContain('onclick')
  expect(clean).not.toContain('position')
  expect(clean).toContain('a')
  expect(clean).toContain('b')
  expect(clean).toContain('color: red')
})

it('converts plain text and rich HTML both ways', () => {
  expect(cellHTMLFromText('a < b & c\n2')).toBe('a &lt; b &amp; c<br>2')
  expect(flattenCellHTML('a &lt; b &amp; c<br>2')).toBe('a < b & c\n2')
  expect(escapeCellText('a<b')).toBe('a&lt;b')
})

it('unwraps editor paragraphs and keeps hard breaks', () => {
  expect(editorHTMLToCell('<p style="margin:0">a<strong>b</strong><br>c</p>'))
    .toBe('a<strong>b</strong><br>c')
  expect(editorHTMLToCell('<p>a</p><p>b</p>')).toBe('a<br>b')
  expect(editorHTMLToCell('<p></p>')).toBe('')
})
