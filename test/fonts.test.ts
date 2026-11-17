// @vitest-environment jsdom
import type { ResolvedSlidevOptions } from '@slidev/types'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { afterEach, expect, it } from 'vitest'
import JSZip from 'jszip'
import { readFontCSS, saveFont, loadFontCSS } from '../node/fonts'
import { exportProject } from '../node/project'
import { applyProjectFontCSS } from '../client/fonts'

const roots: string[] = []
afterEach(async () => { await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true }))) })
async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'studio-fonts-'))
  roots.push(root)
  const entry = join(root, 'slides.md')
  await writeFile(entry, '# Fonts')
  await writeFile(join(root, 'package.json'), '{"private":true}')
  return { root, options: { userRoot: root, entry, base: '/talk/', data: { config: {}, slides: [{ source: { filepath: entry } }] } } as unknown as ResolvedSlidevOptions }
}

it('registers font faces as standard CSS and carries their original bytes in the project ZIP', async () => {
  const { root, options } = await fixture()
  expect(await readFontCSS(options)).toBe('')
  const bytes = Buffer.from('wOF2 original font fixture')
  await saveFont(options, { name: '演示字体.WOFF2', data: bytes.toString('base64'), family: '演示字体', weight: 400, style: 'normal' })
  const result = await saveFont(options, { name: '演示字体.woff2', data: bytes.toString('base64'), family: '演示字体', weight: 700, style: 'italic' })
  expect(await readFile(join(root, 'public/fonts/演示字体.woff2'))).toEqual(bytes)
  expect(await readFile(join(root, 'public/fonts/演示字体-1.woff2'))).toEqual(bytes)
  expect(result.css).toContain('font-family:"演示字体"')
  expect(result.css).toContain('font-weight:700')
  expect(result.css).toContain('font-style:italic')
  expect(result.css.match(/@font-face/g)).toHaveLength(2)
  expect(result.css).toContain('url("./%E6%BC%94%E7%A4%BA%E5%AD%97%E4%BD%93-1.woff2")')
  expect(applyProjectFontCSS(result.css)).toEqual([{ family: '"演示字体"', label: '演示字体', faces: ['400', '700 italic'] }])
  expect((document.querySelector('#studio-project-fonts') as HTMLStyleElement).sheet!.cssRules[0].cssText).toContain('/fonts/%E6%BC%94%E7%A4%BA%E5%AD%97%E4%BD%93.woff2')
  expect(await loadFontCSS(options)).toContain('url("/fonts/%E6%BC%94%E7%A4%BA%E5%AD%97%E4%BD%93.woff2")')
  const zip = await JSZip.loadAsync((await exportProject(options)).data)
  expect(await zip.file('public/fonts/演示字体.woff2')!.async('nodebuffer')).toEqual(bytes)
  expect(await zip.file('public/fonts/studio-fonts.css')!.async('string')).toBe(result.css)
})

it('rejects unsupported files and invalid font descriptors before writing a registration', async () => {
  const { options } = await fixture()
  const payload = { name: 'font.woff2', data: Buffer.from('wOF2 fixture').toString('base64'), family: 'Title', weight: 400, style: 'normal' as const }
  await expect(saveFont(options, { ...payload, name: 'font.exe' })).rejects.toThrow()
  await expect(saveFont(options, { ...payload, family: '' })).rejects.toThrow()
  await expect(saveFont(options, { ...payload, weight: 0 })).rejects.toThrow()
  expect(await readFontCSS(options)).toBe('')
})

it('builds standard relative CSS font URLs against the registry directory', async () => {
  const { root, options } = await fixture()
  await saveFont(options, { name: 'regular.woff2', data: 'd09GMg==', family: 'Edited', weight: 400, style: 'normal' })
  await writeFile(join(root, 'public/fonts/studio-fonts.css'), `
@font-face{font-family:Edited;src:url('./regular.woff2')}
@font-face{font-family:Bold;src:url(../shared/bold.woff2)}
@font-face{font-family:Italic;src:url("italic.woff2")}
@font-face{font-family:Remote;src:url('https://example.com/font.woff2')}
@font-face{font-family:Root;src:url('/other/font.woff2')}
`)
  const css = await loadFontCSS(options)
  expect(css).toContain('url("/fonts/regular.woff2")')
  expect(css).toContain('url("/shared/bold.woff2")')
  expect(css).toContain('url("/fonts/italic.woff2")')
  expect(css).toContain("url('https://example.com/font.woff2')")
  expect(css).toContain("url('/other/font.woff2')")
})
