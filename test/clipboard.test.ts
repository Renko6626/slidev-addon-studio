import { describe, expect, it } from 'vitest'
import { captureBlock, decodeClipboard, encodeClipboard, insertCopiedBlock } from '../client/md/clipboard'
import { readDrag } from '../client/md/drag'
import { getBlock } from '../client/md/lines'

const deck = 'http://localhost:3071/edit/deck/'
const image = '<img data-studio-element="image" v-drag="[10,20,300,200,15]" style="object-fit:cover" src="/photo.png" alt="Picture" />'

describe('object clipboard', () => {
  it('round-trips a picture and accepts it only for the same deck', () => {
    const copied = captureBlock(image, [0, 1], { deck, page: 2, tag: 'img' })
    expect(decodeClipboard(encodeClipboard(copied), deck)).toEqual(copied)
    expect(decodeClipboard(encodeClipboard(copied), '/other/')).toBeNull()
    expect(decodeClipboard('ordinary text', deck)).toBeNull()
  })

  it('pastes at the original coordinates across pages and offsets same-page copies', () => {
    const copied = captureBlock(image, [0, 1], { deck, page: 2, tag: 'img' })
    const across = insertCopiedBlock('# Target', copied, 0)
    expect(getBlock(across.content, across.range)).toBe(image)
    const offset = insertCopiedBlock(image, copied, 20)
    expect(getBlock(offset.content, offset.range)).toBe(image.replace('[10,20,', '[30,40,'))
    const again = insertCopiedBlock(offset.content, copied, 40)
    expect(readDrag(again.content, again.range)?.pos).toMatchObject({ x: 50, y: 60, w: 300, h: 200, rotate: 15 })
  })

  it('carries the full positioning wrapper but selects its inner block', () => {
    const source = '<v-drag pos="10,20,300,_">\n\nHello **world**\n\n</v-drag>'
    const copied = captureBlock(source, [2, 3], { deck, page: 1 })
    const pasted = insertCopiedBlock('# New page', copied, 20)
    expect(pasted.content).toBe('# New page\n\n<v-drag pos="30,40,300,_">\n\nHello **world**\n\n</v-drag>\n')
    expect(getBlock(pasted.content, pasted.range)).toBe('Hello **world**')
    expect(readDrag(pasted.content, pasted.range)?.pos).toMatchObject({ x: 30, y: 40, w: 300, h: null })
  })

  it('creates a flow-block copy directly after its source', () => {
    const source = '# Heading\n\nA paragraph\n\nLast paragraph'
    const copied = captureBlock(source, [2, 3], { deck, page: 1 })
    const result = insertCopiedBlock(source, copied, 20, [2, 3])
    expect(result.content).toBe('# Heading\n\nA paragraph\n\nA paragraph\n\nLast paragraph')
    expect(result.range).toEqual([4, 5])
  })

  it('preserves click animation wrappers together with positioning', () => {
    const source = '<v-drag pos="10,20,300,_">\n\n<v-click at="2">\n\nHello\n\n</v-click>\n\n</v-drag>'
    const copied = captureBlock(source, [4, 5], { deck, page: 1 })
    const result = insertCopiedBlock('# Target', copied, 20)
    expect(copied.source).toBe(source)
    expect(result.content).toBe('# Target\n\n' + source.replace('10,20,', '30,40,') + '\n')
    expect(getBlock(result.content, result.range)).toBe('Hello')
  })

  it('rejects broken selection ranges in incoming clipboard data', () => {
    const copied = captureBlock(image, [0, 1], { deck, page: 1, tag: 'img' })
    expect(decodeClipboard(JSON.stringify({ ...copied, range: [0, 99] }), deck)).toBeNull()
  })

  it('preserves equal indentation on sibling list items', () => {
    const source = '  - One\n  - Two'
    const copied = captureBlock(source, [0, 2], { deck, page: 1 })
    const result = insertCopiedBlock('# Target', copied, 0)
    expect(getBlock(result.content, result.range)).toBe(source)
  })
})
