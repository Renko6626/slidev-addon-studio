import { afterEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { arrangeSelection, deleteBlock, duplicateBlock } from '../client/actions'
import { selection, setSelectedTargets } from '../client/state'
import { useSlideSource, useStudioHistory } from '../client/composables/useSlideSource'
import type { StudioContext } from '../client/context'
import type { StudioTarget } from '../client/types'

const slide = vi.hoisted(() => ({ info: null as any }))
vi.mock('@slidev/client/composables/useSlideInfo.ts', () => ({ useDynamicSlideInfo: () => ({ info: slide.info }) }))
afterEach(() => { selection.value = null; useStudioHistory().reset(); vi.unstubAllGlobals() })
import { alignDeltas, distributeDeltas } from '../client/selection-geometry'
import { captureBlocks, insertCopiedBlocks, movePositions, removePositions, splitCopiedBlocks } from '../client/md/batch'
import { readDrag } from '../client/md/drag'
import { captureBlock } from '../client/md/clipboard'
import { getBlock } from '../client/md/lines'

const content = '# Keep this heading\n\n<v-drag pos="10,20,100,_,15">\n\nText\n\n</v-drag>\n\n<img v-drag="[200,50,80,60]" src="/photo.png" />'
const ranges: [number, number][] = [[4, 5], [8, 9]]

describe('multiple independent objects', () => {
  it('moves all positions while retaining wrappers, auto height and rotation', () => {
    const next = movePositions(content, ranges, 12, -5)
    expect(readDrag(next, ranges[0])?.pos).toEqual({ x: 22, y: 15, w: 100, h: null, rotate: 15 })
    expect(readDrag(next, ranges[1])?.pos).toEqual({ x: 212, y: 45, w: 80, h: 60, rotate: 0 })
    expect(getBlock(next, [0, 2])).toBe('# Keep this heading\n')
  })

  it('copies all wrappers and selects each inserted range with the same offset', () => {
    const copies = captureBlocks(content, ranges.map(range => ({ range })), { deck: 'deck', page: 1 })
    const result = insertCopiedBlocks(content, copies, 20)
    expect(result.inserted).toHaveLength(2)
    expect(getBlock(result.content, result.inserted[0].range)).toBe('Text')
    expect(readDrag(result.content, result.inserted[0].range)?.pos?.x).toBe(30)
    expect(readDrag(result.content, result.inserted[1].range)?.pos?.x).toBe(220)
    expect(removePositions(content, ranges).trim()).toBe('# Keep this heading')
  })

  it('aligns visual edges and centres without resizing', () => {
    const boxes = [{ x: 10, y: 30, w: 20, h: 40 }, { x: 90, y: 10, w: 50, h: 20 }]
    expect(alignDeltas(boxes, 'right')).toEqual([{ x: 110, y: 0 }, { x: 0, y: 0 }])
    expect(alignDeltas(boxes, 'middle')).toEqual([{ x: 0, y: -10 }, { x: 0, y: 20 }])
  })

  it('distributes unequal objects in input order with equal gaps and fixed endpoints', () => {
    const boxes = [{ x: 160, y: 0, w: 40, h: 20 }, { x: 0, y: 0, w: 20, h: 20 }, { x: 50, y: 0, w: 60, h: 20 }]
    expect(distributeDeltas(boxes, 'x')).toEqual([{ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 10, y: 0 }])
  })
})

it.each(['align', 'duplicate', 'delete'] as const)('reverts the whole %s action with one real history undo', async (operation) => {
  slide.info = ref({ content })
  let writes = 0
  vi.stubGlobal('fetch', async (_url: string, options: { body: string }) => {
    writes++
    return { ok: true, json: async () => ({ content: JSON.parse(options.body).content }) }
  })
  const source = useSlideSource(1)
  const history = useStudioHistory()
  const targets = ranges.map((range, index) => ({
    range, no: 1, kind: 'component', positioned: true, nested: false, label: 'Object',
    el: { getBoundingClientRect: () => ({ left: index * 200, top: index * 30, width: 100, height: 80 }) },
  } as unknown as StudioTarget))
  setSelectedTargets(targets)
  const studio = {
    no: () => 1, content: () => source.content.value,
    canvas: { scale: ref(1) }, commit: source.setContent,
    selectInsertedMany: async () => true,
  } as unknown as StudioContext
  if (operation === 'align') await arrangeSelection(studio, 'left')
  else if (operation === 'duplicate') await duplicateBlock(studio, targets[1])
  else await deleteBlock(studio, targets[1])
  expect(writes).toBe(1)
  const changed = source.content.value
  expect(changed).not.toBe(content)
  await history.undo()
  expect(source.content.value).toBe(content)
  expect(history.canUndo.value).toBe(false)
  await history.redo()
  expect(source.content.value).toBe(changed)
})

it('keeps a single copied container containing positioned children intact', () => {
  const container = '<div>\n<img v-drag="[10,20,100,80]" />\n<img v-drag="[200,20,100,80]" />\n</div>'
  const copied = captureBlock(container, [0, 4], { deck: 'deck', page: 1 })
  expect(splitCopiedBlocks(copied)).toEqual([copied])
})

it('warns before deleting a question control and leaves its independent children when confirmed', async () => {
  const title = '<StudioQuestionTitle question="q" v-drag="[10,60,400,80]" />'
  const button = '<StudioButton question="q" action="choose" option="A" />'
  const original = `<StudioQuestion question="q" presentation="hidden" v-drag="[10,10,220,32]" />\n\n${title}\n\n${button}`
  let source = original
  const confirm = vi.fn(() => false)
  vi.stubGlobal('window', { confirm })
  const target = { range: [0, 1], no: 1, kind: 'component', tag: 'StudioQuestion', label: 'Question', el: {} } as StudioTarget
  setSelectedTargets([target])
  const studio = { content: () => source, commit: async (next: string) => { source = next } } as unknown as StudioContext
  await deleteBlock(studio, target)
  expect(source).toBe(original)
  expect(selection.value).toBe(target)
  confirm.mockReturnValue(true)
  await deleteBlock(studio, target)
  expect(source).not.toContain('<StudioQuestion ')
  expect(source).toContain(title)
  expect(source).toContain(button)
})
