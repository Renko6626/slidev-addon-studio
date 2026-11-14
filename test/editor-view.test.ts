import { describe, expect, it } from 'vitest'
import { editorOpenFromQuery, fitSlide } from '../client/editor-view'

describe('editor view', () => {
  it('honours explicit entry modes without discarding the ordinary preference', () => {
    expect(editorOpenFromQuery('1', false)).toBe(true)
    expect(editorOpenFromQuery('0', true)).toBe(false)
    expect(editorOpenFromQuery(undefined, true)).toBe(true)
    expect(editorOpenFromQuery(undefined, false)).toBe(false)
    expect(editorOpenFromQuery('unknown', false)).toBe(false)
  })

  it('fits a wide slide into a tall workspace and centres it', () => {
    expect(fitSlide({ left: 200, top: 120, width: 848, height: 648 }, { width: 1600, height: 900 }))
      .toEqual({ left: 224, top: 219, width: 800, height: 450, scale: 0.5 })
  })

  it('fits a tall slide into a wide workspace', () => {
    expect(fitSlide({ left: 100, top: 100, width: 1048, height: 548 }, { width: 500, height: 1000 }))
      .toEqual({ left: 499, top: 124, width: 250, height: 500, scale: 0.5 })
  })

  it('keeps an unmeasured workspace finite', () => {
    expect(fitSlide({ left: 0, top: 0, width: 0, height: 0 }, { width: 1600, height: 900 }))
      .toEqual({ left: 0, top: 0, width: 0, height: 0, scale: 0 })
  })
})
