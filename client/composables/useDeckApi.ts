import { t } from '../i18n'
import { serverErrorText } from '../i18n/errors'
import type { StudioAsset } from '../types'
import { busy, reportError } from '../state'
import { trackProjectWrite } from '../project-save'
import { assetKind, assetLimitMiB } from '../../shared/assets'
import type { FontUpload } from '../../shared/fonts'
import { FONT_LIMIT_MIB, isFontFile } from '../../shared/fonts'

/**
 * The dev-only endpoints Studio adds on top of Slidev's own.
 *
 * Slidev can patch a slide, but not add, remove or reorder one, and it has no
 * notion of dropping a file into `public/`. These are served by the addon's
 * Vite plugin and rewrite the Markdown file directly; the file watcher then
 * pushes the result back to the browser like any other edit.
 */

const BASE = `${import.meta.env.BASE_URL}@studio/`

async function request<T>(route: string, init?: RequestInit): Promise<T | null> {
  busy.value = true
  try {
    const response = await fetch(BASE + route, init)
    const body = await response.json()
    if (!response.ok || body?.error)
      throw new Error(body?.error ? serverErrorText(body) : t('errorRequest', { status: response.status }), { cause: body?.error })
    return body as T
  }
  catch (error) {
    reportError(error)
    return null
  }
  finally {
    busy.value = false
  }
}

function post<T>(route: string, payload: unknown) {
  return trackProjectWrite(async () => {
    const result = await request<T>(route, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (result === null) throw new Error(t('projectWriteFailed'))
    return result
  }).catch(() => null)
}

export interface DeckResult {
  ok: true
  no: number
  total: number
}

export const deckApi = {
  insert: (after: number, content?: string, frontmatter?: string) =>
    post<DeckResult>('deck', { action: 'insert', after, content, frontmatter }),
  duplicate: (no: number) => post<DeckResult>('deck', { action: 'duplicate', no }),
  remove: (no: number) => post<DeckResult>('deck', { action: 'remove', no }),
  move: (no: number, to: number) => post<DeckResult>('deck', { action: 'move', no, to }),
}

export const assetApi = {
  list: () => request<{ assets: StudioAsset[], root: string }>('assets'),
  upload: (name: string, data: string, dir?: string) => post<StudioAsset>('assets', { name, data, dir }),
}

export const fontApi = {
  list: () => request<{ css: string }>('fonts'),
  upload: (payload: FontUpload) => post<{ css: string }>('fonts', payload),
}

/** Reads a dropped file as base64 for the upload endpoint. */
export function readAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const kind = assetKind(file.name)
    const limit = kind ? assetLimitMiB(kind) : isFontFile(file.name) ? FONT_LIMIT_MIB : null
    if (limit === null) return reject(new Error(t('errorUnsupportedAssetType', { type: file.name.split('.').pop() ?? file.name })))
    if (file.size > limit * 1024 * 1024)
      return reject(new Error(t('errorAssetTooLarge', { size: limit })))
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}
