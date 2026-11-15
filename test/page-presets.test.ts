import { describe, expect, it } from 'vitest'
import { createPresetPage, PAGE_PRESETS, pagePresetElements } from '../client/page-presets'
import { patchElementAttribute, readElement, readTextContent, replaceTextContent } from '../client/md/elements'
import { readDrag } from '../client/md/drag'
import en from '../client/i18n/en'
import zh from '../client/i18n/zh-CN'

const canvas = { width: 1000, height: 562.5 }

describe('page presets', () => {
  it('creates a genuinely empty slide with an explicit layout', () => {
    const page = createPresetPage(PAGE_PRESETS[0], canvas, key => zh[key])
    expect(page.content).toBe('')
    expect(page.frontmatter).toBe('layout: none\ntitle: "空白"')
  })

  it('creates independently editable text in both columns', () => {
    const page = createPresetPage(PAGE_PRESETS.find(p => p.id === 'columns')!, canvas, key => zh[key])
    const blocks = page.content.split('\n\n')
    expect(blocks).toHaveLength(3)
    expect(blocks.map(block => readElement(block, [0, 1])?.kind)).toEqual(['text', 'text', 'text'])
    expect(readTextContent(blocks[1], [0, 1])).toBe('在这里填写左栏内容。')
    expect(readTextContent(blocks[2], [0, 1])).toBe('在这里填写右栏内容。')
    const edited = replaceTextContent(page.content, [2, 3], '<p>活动安排</p>')
    expect(readTextContent(edited, [2, 3])).toBe('<p>活动安排</p>')
    expect(readTextContent(edited, [4, 5])).toBe('在这里填写右栏内容。')
    expect(readDrag(edited, [2, 3])?.pos?.x).toBe(60)
    expect(readDrag(edited, [4, 5])?.pos?.x).toBe(520)
  })

  it('replaces a full-page image without losing its frame', () => {
    const { content } = createPresetPage(PAGE_PRESETS.find(p => p.id === 'image')!, canvas, key => en[key])
    expect(readElement(content, [0, 1])?.src).toMatch(/^data:image\/svg\+xml,/)
    const replaced = patchElementAttribute(content, [0, 1], 'src', '/photos/event.png')
    expect(readElement(replaced, [0, 1])?.src).toBe('/photos/event.png')
    expect(readElement(replaced, [0, 1])?.styles['object-fit']).toBe('cover')
    expect(readDrag(replaced, [0, 1])?.pos).toEqual({ x: 0, y: 0, w: 1000, h: 563, rotate: 0 })
  })

  it('keeps preview and saved objects in the same positions on a 4:3 canvas', () => {
    const size = { width: 800, height: 600 }
    for (const preset of PAGE_PRESETS.slice(1)) {
      const preview = pagePresetElements(preset, size, key => en[key])
      const blocks = createPresetPage(preset, size, key => en[key]).content.split('\n\n')
      for (const [index, box] of preview.entries()) {
        const pos = readDrag(blocks[index], [0, 1])!.pos!
        expect(pos.x).toBeCloseTo(box.x, 0)
        expect(pos.y).toBeCloseTo(box.y, 0)
        expect(pos.w).toBeCloseTo(box.w, 0)
        expect(pos.x + pos.w).toBeLessThanOrEqual(800)
        expect(box.y + box.h).toBeLessThanOrEqual(600)
        expect(readElement(blocks[index], [0, 1])?.kind).toBe(box.kind)
      }
    }
  })
})
