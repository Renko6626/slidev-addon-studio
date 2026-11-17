import type { ResolvedSlidevOptions } from '@slidev/types'
import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { assetRoot, savePublicFile } from './assets'
import { FONT_CSS_PATH, FONT_LIMIT_MIB, fontFamilyValue, isFontFile } from '../shared/fonts'
import type { FontUpload } from '../shared/fonts'
import { StudioError } from '../shared/errors'

export async function readFontCSS(options: ResolvedSlidevOptions) {
  try { return await readFile(join(assetRoot(options), FONT_CSS_PATH), 'utf8') }
  catch (error: any) { if (error.code === 'ENOENT') return ''; throw error }
}

export async function saveFont(options: ResolvedSlidevOptions, payload: FontUpload) {
  if (!isFontFile(payload.name)) throw new StudioError('unsupportedAssetType', 'Unsupported font file', { type: payload.name })
  const family = payload.family?.trim()
  if (!family || /[\u0000-\u001f{};<>]/.test(family) || !Number.isInteger(payload.weight) || payload.weight < 1 || payload.weight > 1000 || !['normal', 'italic'].includes(payload.style))
    throw new StudioError('invalidFont', 'Enter a font family, weight (1–1000) and normal/italic style.')
  const css = await readFontCSS(options)
  const file = await savePublicFile(options, payload, 'fonts', FONT_LIMIT_MIB)
  const url = `./${file.url.split('/').at(-1)}`
  const next = `${css}${css && !css.endsWith('\n') ? '\n' : ''}@font-face{font-family:${fontFamilyValue(family)};src:url("${url}");font-weight:${payload.weight};font-style:${payload.style};font-display:swap;}\n`
  await writeFile(join(assetRoot(options), FONT_CSS_PATH), next)
  return { css: next }
}

/** Static CSS registration survives both the dev server and site export. */
export async function loadFontCSS(options: ResolvedSlidevOptions) {
  const css = await readFontCSS(options)
  // The virtual CSS entry has no file directory. Public URLs let Vite apply
  // the same base handling as the rest of the deck's ordinary public assets.
  return css.replace(/url\(\s*(?:"([^"]*)"|'([^']*)'|([^)]*))\s*\)/gi, (original, double: string | undefined, single: string | undefined, bare: string | undefined) => {
    const value = (double ?? single ?? bare ?? '').trim()
    if (!value || /^(?:[a-z][a-z\d+.-]*:|\/|#)/i.test(value)) return original
    const url = new URL(value, 'http://studio.local/fonts/studio-fonts.css')
    return `url("${url.pathname}${url.search}${url.hash}")`
  })
}
