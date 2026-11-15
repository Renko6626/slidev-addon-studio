import { describe, expect, it } from 'vitest'
import { appendElement, createImageElement, createTextElement, fitImageSize, patchElementAttribute, patchElementStyle, readElement, readImagePosition, replaceTextContent, resizeElement } from '../client/md/elements'
import { getBlock } from '../client/md/lines'
import { readDrag } from '../client/md/drag'

const canvas = { width: 1000, height: 600 }

describe('basic elements', () => {
  it('appends a text box with its own exact range even beside identical text', () => {
    const text = createTextElement(canvas, '输入文字')
    const inserted = appendElement(text, text)
    expect(inserted.range).toEqual([2, 3])
    expect(getBlock(inserted.content, inserted.range)).toBe(text)
    expect(readElement(inserted.content, inserted.range)?.kind).toBe('text')
    expect(readDrag(inserted.content, inserted.range)?.pos).toEqual({ x: 300, y: 282, w: 400, h: null, rotate: 0 })
  })

  it('changes one text style without changing position, other styles or neighbours', () => {
    const source = '# Intro\n\n<div data-studio-element="text" v-drag="[12,34,400,NaN,15]" class="custom" style="font-size:28px; color:red; line-height:1.5">Hello</div>\n\nEnd'
    const next = patchElementStyle(source, [2, 3], { color: '#123456' })
    expect(next).toBe(source.replace('color:red', 'color:#123456'))
    expect(readElement(next, [2, 3])?.styles.color).toBe('#123456')
  })

  it('writes multiple paragraphs and inline formatting while preserving the text box root', () => {
    const box = createTextElement(canvas, 'Before')
    const html = '<div>第一行 <b>粗体</b></div><div>第二行<br>换行 &amp; 空格</div>'
    const next = replaceTextContent(box, [0, 1], html)
    expect(next).toBe(box.replace('Before</div>', `${html}</div>`))
    expect(readDrag(next, [0, 1])?.pos?.h).toBeNull()
  })

  it('round-trips attribute characters and changes only the image source on replacement', () => {
    const box = createImageElement(canvas, { width: 800, height: 400 }, '/a.png', 'A & "B" <C>')
    expect(readElement(box, [0, 1])?.alt).toBe('A & "B" <C>')
    const next = patchElementAttribute(box, [0, 1], 'src', '/next.png?x=1&y=2')
    expect(next).toBe(box.replace('src="/a.png"', 'src="/next.png?x=1&amp;y=2"'))
    expect(readElement(next, [0, 1])?.src).toBe('/next.png?x=1&y=2')
    expect(readDrag(next, [0, 1])).toEqual(readDrag(box, [0, 1]))
  })

  it('fits wide and tall images without enlarging small images', () => {
    expect(fitImageSize({ width: 1200, height: 600 }, canvas)).toEqual({ width: 600, height: 300 })
    expect(fitImageSize({ width: 600, height: 1200 }, canvas)).toEqual({ width: 195, height: 390 })
    expect(fitImageSize({ width: 120, height: 80 }, canvas)).toEqual({ width: 120, height: 80 })
  })

  it('positions a cropped image and keeps the frame and position when replacing it', () => {
    const source = '<img data-studio-element="image" v-drag="[10,20,300,200,15]" data-studio-lock-ratio="false" style="object-fit:cover;object-position:center;border-radius:8px" src="/before.png" alt="Portrait" />\n\nNeighbour'
    const positioned = patchElementStyle(source, [0, 1], { 'object-position': '25% 80%' })
    const replaced = patchElementAttribute(positioned, [0, 1], 'src', '/after.png')
    expect(replaced).toBe(source.replace('object-position:center', 'object-position:25% 80%').replace('/before.png', '/after.png'))
    expect(readElement(replaced, [0, 1])?.styles['object-position']).toBe('25% 80%')
    expect(readDrag(replaced, [0, 1])?.pos).toEqual({ x: 10, y: 20, w: 300, h: 200, rotate: 15 })
    expect(readImagePosition(readElement(replaced, [0, 1])!.styles['object-position'])).toEqual({ x: 25, y: 80 })
    expect(readImagePosition('center')).toEqual({ x: 50, y: 50 })
    expect(readImagePosition('top right')).toEqual({ x: 100, y: 0 })
  })

  it('links picture dimensions while locked and keeps text height automatic', () => {
    const picture = createImageElement(canvas, { width: 800, height: 400 }, '/a.png', '')
    const resized = resizeElement(picture, [0, 1], 'w', 300)
    expect(readDrag(resized, [0, 1])?.pos).toMatchObject({ w: 300, h: 150 })
    const free = patchElementAttribute(picture, [0, 1], 'data-studio-lock-ratio', 'false')
    expect(readDrag(resizeElement(free, [0, 1], 'w', 300), [0, 1])?.pos).toMatchObject({ w: 300, h: 300 })
    const text = createTextElement(canvas, 'Text')
    expect(readDrag(resizeElement(text, [0, 1], 'w', 280), [0, 1])?.pos).toMatchObject({ w: 280, h: null })
  })
})
