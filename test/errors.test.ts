import type { ResolvedSlidevOptions } from '@slidev/types'
import { afterEach, describe, expect, it } from 'vitest'
import { studioLocale } from '../client/i18n'
import { serverErrorText } from '../client/i18n/errors'
import { saveAsset } from '../node/assets'
import { applyDeckAction } from '../node/deck'
import { studioErrorResponse } from '../shared/errors'

afterEach(() => (studioLocale.value = 'en'))

describe('localized server errors', () => {
  it('carries page parameters through the existing error response', async () => {
    const options = { data: { slides: [] } } as unknown as ResolvedSlidevOptions
    const error = await applyDeckAction(options, { action: 'duplicate', no: 7 }).catch(error => error)
    const response = studioErrorResponse(error)
    expect(response).toEqual({
      error: 'Slide 7 does not exist (deck has 0)',
      code: 'slideNotFound',
      params: { number: 7, total: 0 },
    })
    studioLocale.value = 'zh-CN'
    expect(serverErrorText(response)).toBe('找不到第 7 页，当前共 0 页。')
    studioLocale.value = 'en'
    expect(serverErrorText(response)).toBe(response.error)
  })

  it('translates an upload validation error without changing its original message', async () => {
    const error = await saveAsset({} as ResolvedSlidevOptions, { name: 'file.exe', data: '' }).catch(error => error)
    const response = studioErrorResponse(error)
    expect(response.error).toBe('Unsupported file type ".exe"')
    studioLocale.value = 'zh-CN'
    expect(serverErrorText(response)).toBe('不支持文件类型“.exe”。')
  })

  it('keeps uncoded diagnostics and unknown server codes compatible', () => {
    studioLocale.value = 'zh-CN'
    const response = studioErrorResponse(new Error('Disk full'))
    expect(response).toEqual({ error: 'Disk full' })
    expect(serverErrorText(response)).toBe('Disk full')
    expect(serverErrorText({ error: 'New server message', code: 'futureCode' })).toBe('New server message')
  })
})
