// @vitest-environment jsdom
import { afterEach, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import type { StudioTarget } from '../client/types'
import { createTextElement, createImageElement, readElement } from '../client/md/elements'
import { createShape } from '../client/md/shapes'
import { readDrag } from '../client/md/drag'
import { readClicks } from '../client/md/clicks'
import { getBlock } from '../client/md/lines'
import { canWriteLayer, readLayer, writeLayer } from '../client/md/layers'
import { canMoveLayer, objectLayers, reorderLayers } from '../client/layers'

const canvas = { width: 960, height: 540 }
const first = createTextElement(canvas, 'Covered text').replace('style="', 'v-click="2" style="')
const middle = createImageElement(canvas, { width: 100, height: 80 }, '/picture.png', 'Picture')
const last = createShape('rect', { x: 20, y: 30, w: 120, h: 80, rotate: 15 })

afterEach(() => document.body.replaceChildren())

function fixture(snippets = [first, middle, last]) {
  const parent = document.createElement('div')
  document.body.append(parent)
  const content = snippets.join('\n\n')
  let line = 0
  const targets: StudioTarget[] = snippets.map(snippet => {
    const range: [number, number] = [line, line + snippet.split('\n').length]
    line = range[1] + 1
    const template = document.createElement('template')
    template.innerHTML = snippet
    const el = template.content.firstElementChild as HTMLElement
    // v-drag is supplied by Slidev; the DOM and source surgery here are real.
    el.style.position = 'absolute'
    if (!el.style.zIndex) el.style.zIndex = '100'
    parent.append(el)
    return { el, range, no: 1, kind: 'html', positioned: true, nested: false, label: '', element: readElement(content, range)?.kind }
  })
  return { content, targets, parent }
}

it('lists covered objects in actual same-parent stacking order', () => {
  const s = fixture()
  // All three boxes overlap; the back object remains available in the list.
  const [group] = objectLayers(s.targets, s.content)
  expect(group.map(item => item.target.el)).toEqual(s.targets.map(target => target.el).reverse())
  expect(group.at(-1)?.target.el.textContent).toBe('Covered text')
  expect(group.every(item => item.orderable)).toBe(true)
})

it.each([
  ['forward', 0, [1, 0, 2]], ['backward', 2, [0, 2, 1]],
  ['front', 0, [1, 2, 0]], ['back', 2, [2, 0, 1]],
] as const)('persists %s without moving source, positions or click steps', (direction, selected, backToFront) => {
  const s = fixture()
  const next = reorderLayers(s.content, objectLayers(s.targets, s.content)[0], s.targets[selected], direction)
  expect(backToFront.map(index => readLayer(next, s.targets[index].range!))).toEqual([100, 101, 102])
  for (const target of s.targets) {
    expect(readDrag(next, target.range!)).toEqual(readDrag(s.content, target.range!))
    expect(readClicks(next, target.range!)).toEqual(readClicks(s.content, target.range!))
    expect(readElement(next, target.range!)).toEqual(readElement(s.content, target.range!))
  }
  expect(getBlock(next, [0, 1])).toContain('Covered text')
  expect(getBlock(next, [2, 3])).toContain('/picture.png')
  expect(getBlock(next, [4, 5])).toContain('<StudioShape')
  expect(next.split('\n')).toHaveLength(s.content.split('\n').length)
})

it('keeps existing explicit visual order and disables moves at the boundaries', () => {
  const s = fixture([first.replace('style="', 'style="z-index:250 !important;'), middle, last])
  const [group] = objectLayers(s.targets, s.content)
  expect(group[0].target).toBe(s.targets[0])
  expect(canMoveLayer(group, s.targets[0], 'forward')).toBe(false)
  const next = reorderLayers(s.content, group, s.targets[0], 'back')
  const template = document.createElement('template')
  template.innerHTML = getBlock(next, [0, 1])
  const el = template.content.firstElementChild as HTMLElement
  expect(el.style.getPropertyValue('z-index')).toBe('')
  expect(el.style.getPropertyValue('--studio-z-index')).toBe('100')
  expect(el.style.fontSize).toBe('28px')
})

it('does not reorder different containers, dynamic attributes or unknown components', () => {
  const dynamic = first.replace('style="', ':style="')
  const component = '<UnverifiedWidget v-drag="[20,30,100,80]" />'
  const s = fixture([first, middle, dynamic, component])
  const nestedParent = document.createElement('div')
  s.parent.append(nestedParent)
  nestedParent.append(s.targets[1].el)
  const groups = objectLayers(s.targets, s.content)
  expect(groups).toHaveLength(2)
  expect(groups[0].filter(item => item.orderable).map(item => item.target)).toEqual([s.targets[0]])
  expect(canMoveLayer(groups[0], s.targets[0], 'front')).toBe(false)
  expect(reorderLayers(s.content, groups.flat(), s.targets[0], 'back')).toBe(s.content)
  expect(canWriteLayer(s.content, s.targets[2].range!)).toBe(false)
})

it('persists known interaction roots while retaining their bindings and dynamic-style limits', () => {
  const snippets = [
    '<StudioQuestion question="q1" title="Question" v-drag="[20,30,300,80]" />',
    '<StudioButton question="q1" action="choose" option="a" v-drag="[20,120,300,60]" />',
    '<StudioFeedback question="q1" effect="fade" v-drag="[20,220,300,60]" />',
  ]
  const s = fixture(snippets)
  const next = reorderLayers(s.content, objectLayers(s.targets, s.content)[0], s.targets[0], 'front')
  expect(readLayer(next, s.targets[0].range!)).toBe(102)
  expect(getBlock(next, s.targets[1].range!)).toContain('question="q1" action="choose" option="a"')
  expect(readDrag(next, s.targets[0].range!)).toEqual(readDrag(s.content, s.targets[0].range!))
  expect(canWriteLayer(snippets[1].replace('/>', ':style="buttonStyle" />'), [0, 1])).toBe(false)
  expect(canWriteLayer(snippets[1].replace('/>', ':class="buttonClass" />'), [0, 1])).toBe(false)
})

it('preserves multiline attribute ranges while writing all peers in one update', () => {
  const multiline = first.replace('style="', 'class="\ncustom\n" style="z-index:150;\n')
  const s = fixture([multiline, middle])
  const next = reorderLayers(s.content, objectLayers(s.targets, s.content)[0], s.targets[0], 'back')
  expect(next.split('\n')).toHaveLength(s.content.split('\n').length)
  expect(s.targets.map(target => readLayer(next, target.range!))).toEqual([100, 101])
  expect(readDrag(next, s.targets[1].range!)).toEqual(readDrag(s.content, s.targets[1].range!))
})

it('excludes backgrounds and refuses ambiguous shared source ranges', () => {
  const s = fixture()
  s.targets[2].el.setAttribute('data-studio-background', '')
  s.targets[1].range = s.targets[0].range
  const [group] = objectLayers(s.targets, s.content)
  expect(group).toHaveLength(2)
  expect(group.every(item => !item.orderable)).toBe(true)
})

it('keeps the layer stylesheet priority and saved rank when Slidev rewrites inline z-index', () => {
  const source = writeLayer(first, [0, 1], 103)
  const s = fixture([source])
  const sheet = document.createElement('style')
  sheet.textContent = readFileSync('styles/layers.css', 'utf8')
  document.body.append(sheet)
  const el = s.targets[0].el
  el.style.zIndex = '100'
  const rule = sheet.sheet!.cssRules[0] as CSSStyleRule
  expect(el.matches(rule.selectorText)).toBe(true)
  expect(el.style.getPropertyValue('--studio-z-index')).toBe('103')
  expect(el.style.getPropertyPriority('z-index')).toBe('')
  expect(rule.style.getPropertyPriority('z-index')).toBe('important')
  expect(rule.style.getPropertyValue('z-index')).toBe('var(--studio-z-index)')
})
