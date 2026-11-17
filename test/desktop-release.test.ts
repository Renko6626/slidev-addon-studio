import { createRequire } from 'node:module'
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, expect, it } from 'vitest'

const { checkDesktopRelease, readDesktopRelease } = createRequire(import.meta.url)('../desktop/client-release.cjs')
const roots: string[] = []
afterEach(() => roots.splice(0).forEach(root => rmSync(root, { recursive: true, force: true })))
function release(version: string, changes = {}) {
  return { tag_name: `desktop-v${version}`, draft: false, prerelease: false, body: `Notes ${version}`,
    assets: [{ name: `Slidev-Studio-${version}-win32-x64-online.zip`, state: 'uploaded' }], ...changes }
}

it('selects the highest numeric stable desktop version with its matching portable ZIP', async () => {
  const result = await checkDesktopRelease({ fetchImpl: async () => new Response(JSON.stringify([
    release('0.9.9'), release('0.10.0'), release('1.0.0', { prerelease: true }),
    release('2.0.0', { draft: true }), release('3.0.0', { assets: [{ name: 'source.zip' }] }),
    release('4.0.0', { tag_name: 'v4.0.0' }), release('05.0.0'),
  ])) })
  expect(result).toEqual({ version: '0.10.0', notes: 'Notes 0.10.0',
    url: 'https://github.com/Renko6626/slidev-addon-studio/releases/tag/desktop-v0.10.0' })
})

it('continues through release pages to find desktop builds among npm releases', async () => {
  const result = await checkDesktopRelease({ fetchImpl: async (url: string) => {
    const page = new URL(url).searchParams.get('page')
    if (page === '1') return new Response(JSON.stringify([release('0.5.2', { tag_name: 'v0.5.2' })]),
      { headers: { Link: '<https://api.github.com/repos/Renko6626/slidev-addon-studio/releases?per_page=100&page=2>; rel="next"' } })
    return new Response(JSON.stringify([release('0.6.0')]))
  } })
  expect(result?.version).toBe('0.6.0')
})

it('reports lookup failure instead of claiming that the client is current', async () => {
  await expect(checkDesktopRelease({ fetchImpl: async () => new Response('', { status: 503 }) })).rejects.toThrow('503')
  expect(await checkDesktopRelease({ fetchImpl: async () => new Response('[]') })).toBeNull()
})

it('reads one mandatory desktop changelog and keeps editor and desktop versions independent', () => {
  const root = mkdtempSync(join(tmpdir(), 'desktop-release-')); roots.push(root)
  mkdirSync(join(root, 'desktop'))
  mkdirSync(join(root, 'docs/releases'), { recursive: true })
  writeFileSync(join(root, 'package.json'), JSON.stringify({ version: '0.5.2' }))
  writeFileSync(join(root, 'desktop/package.json'), JSON.stringify({ version: '0.8.0' }))
  expect(() => readDesktopRelease(root)).toThrow('desktop-0.8.0.md')
  writeFileSync(join(root, 'docs/releases/desktop-0.8.0.md'), '# Desktop 0.8.0\n\nEditor 0.5.2\n')
  expect(readDesktopRelease(root)).toEqual({ desktopVersion: '0.8.0', studioVersion: '0.5.2', notes: '# Desktop 0.8.0\n\nEditor 0.5.2\n' })
})
