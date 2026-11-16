// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { StudioContext } from '../client/context'
import type { StudioTarget } from '../client/types'
const host = vi.hoisted(() => ({ studio: null as StudioContext | null }))
vi.mock('../client/context', () => ({ useStudio: () => host.studio }))
import { changePageBackground, isFreeCanvasPage } from '../client/composables/usePageBackground'
import { imageLibraryRequest, imagePending, useImageInsertion } from '../client/composables/useImageInsertion'
import { activePanel, busy, editing, hovered, selectedTargets, selection, setSelectedTargets } from '../client/state'
import { mappedElements } from '../client/dom'
import { readPageBackground, setPageBackground } from '../client/md/background'
import { createTextElement } from '../client/md/elements'

afterEach(() => {
  document.body.replaceChildren()
  selection.value = null
  hovered.value = null
  imageLibraryRequest.value = null
  imagePending.value = false
  busy.value = false
  editing.value = false
})

describe('page backgrounds', () => {
  it('switches colour to image and removes it without changing the page objects', () => {
    const objects = createTextElement({ width: 1000, height: 600 }, 'Page title')
    const coloured = setPageBackground(objects, { kind: 'color', value: '#dce8ff' })
    expect(readPageBackground(coloured)).toMatchObject({ kind: 'color', value: '#dce8ff' })
    const pictured = setPageBackground(coloured, { kind: 'image', value: '/a&b.png' })
    expect(readPageBackground(pictured)).toMatchObject({ kind: 'image', value: '/a&b.png' })
    expect(setPageBackground(pictured, null)).toBe(objects)
    document.body.innerHTML = pictured
    const background = document.querySelector<HTMLElement>('[data-studio-background]')!
    expect(background.getAttribute('src')).toBe('/a&b.png')
    expect(background.style.objectFit).toBe('cover')
    expect(background.style.zIndex).toBe('0')
    expect(background.style.pointerEvents).toBe('none')
  })

  it('excludes the background from selectable objects and recognises hidden positioned content', () => {
    const object = createTextElement({ width: 1000, height: 600 }, 'Page title')
    const content = setPageBackground(object, { kind: 'color', value: '#ddeeff' })
    document.body.innerHTML = `<div id="slide-content"><div data-slidev-no="1">${content}</div></div>`
    const bg = document.querySelector<HTMLElement>('[data-studio-background]')!
    bg.dataset.studioSrc = '0,1'
    const text = document.querySelector<HTMLElement>('[data-studio-element]')!
    text.dataset.studioSrc = '2,3'
    text.style.opacity = '0'
    expect(mappedElements(1)).toEqual([text])
    expect(isFreeCanvasPage(1, content)).toBe(true)
    const paragraph = document.createElement('p')
    paragraph.dataset.studioSrc = '4,5'
    paragraph.textContent = 'Ordinary Markdown'
    text.after(paragraph)
    expect(isFreeCanvasPage(1, `${content}\n\nOrdinary Markdown`)).toBe(false)
    expect(isFreeCanvasPage(1, '')).toBe(true)
  })
  it('clears the object selection before each page-background write and keeps page settings open', async () => {
    const objects = ['Left column', 'Right column'].map(text => createTextElement({ width: 1000, height: 600 }, text)).join('\n\n')
    let source = objects
    const writes: StudioTarget[][] = []
    const targets: StudioTarget[] = [0, 1].map(index => ({ el: document.createElement('div'), no: 1, range: [index * 2, index * 2 + 1], kind: 'html', tag: 'div', element: 'text', positioned: true, nested: false, label: `Column ${index}` }))
    const studio = { content: () => source, commit: async (next: string) => { writes.push([...selectedTargets.value]); source = next } }
    for (const background of [{ kind: 'color', value: '#ddeeff' }, { kind: 'image', value: '/photo.png' }, null] as const) {
      setSelectedTargets(targets)
      hovered.value = targets[0]
      activePanel.value = 'inspect'
      await changePageBackground(studio, background)
      expect(selection.value).toBeNull()
      expect(hovered.value).toBeNull()
      expect(activePanel.value).toBe('layout')
      expect(readPageBackground(source)?.value ?? null).toBe(background?.value ?? null)
    }
    expect(writes).toEqual([[], [], []])
    expect(source).toBe(objects)
  })

  it('keeps selection and source when a background file choice is cancelled', () => {
    const target: StudioTarget = { el: document.createElement('div'), no: 1, range: [0, 1], kind: 'html', tag: 'div', element: 'text', positioned: true, nested: false, label: 'Page title' }
    const targets = [target, { ...target, range: [2, 3] as [number, number] }]
    setSelectedTargets(targets)
    let writes = 0
    host.studio = { no: () => 1, content: () => '', frontmatter: () => ({ layout: 'none' }), commit: async () => { writes++ } } as unknown as StudioContext
    useImageInsertion().backgroundFromFile()
    const picker = document.querySelector('input[type="file"]')!
    picker.dispatchEvent(new Event('cancel'))
    expect(document.querySelector('input[type="file"]')).toBeNull()
    expect(selectedTargets.value).toEqual(targets)
    expect(writes).toBe(0)
  })
})

it('replaces an image field on its component without creating a separate image object', async () => {
  const before = '<Card image-src="/old.svg" content-html="Keep" v-drag="[10,20,300,120]" />\n\nNeighbor'
  let content = before
  let writes = 0
  const target = { el: document.createElement('div'), no: 1, range: [0, 1], kind: 'component', tag: 'Card', positioned: true, nested: false, label: 'Card' } as StudioTarget
  selection.value = target
  host.studio = { no: () => 1, content: () => content, commit: async (next: string) => { content = next; writes++ }, selectInserted: async () => true } as unknown as StudioContext
  const NativeImage = globalThis.Image
  vi.stubGlobal('Image', class {
    naturalWidth = 400; naturalHeight = 200
    onload: (() => void) | null = null
    set src(_value: string) { queueMicrotask(() => this.onload?.()) }
  })
  try {
    const images = useImageInsertion()
    images.forField(target, { name: 'imageSrc', control: 'image' }, false)
    await images.chooseAsset({ name: 'new.svg', url: '/new.svg', size: 100, kind: 'image' })
    expect(content).toBe('<Card :image-src="&quot;/new.svg&quot;" content-html="Keep" v-drag="[10,20,300,120]" />\n\nNeighbor')
    expect(writes).toBe(1)
    expect(imageLibraryRequest.value).toBeNull()
    expect(imagePending.value).toBe(false)
  }
  finally { vi.stubGlobal('Image', NativeImage) }
})

it('cancels a component image file picker without altering its field', () => {
  const content = '<Card image-src="/old.svg" />'
  const target = { el: document.createElement('div'), no: 1, range: [0, 1], kind: 'component', tag: 'Card', positioned: false, nested: false, label: 'Card' } as StudioTarget
  let writes = 0
  host.studio = { no: () => 1, content: () => content, commit: async () => { writes++ } } as unknown as StudioContext
  useImageInsertion().forField(target, { name: 'imageSrc', control: 'image' }, true)
  const picker = document.querySelector('input[type="file"]')!
  expect(picker).not.toBeNull()
  picker.dispatchEvent(new Event('cancel'))
  expect(document.querySelector('input[type="file"]')).toBeNull()
  expect(writes).toBe(0)
})
