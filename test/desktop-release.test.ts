import { createRequire } from 'node:module'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
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

function nativeFixture(check: () => Promise<unknown>, responses: number[]) {
  const { createClientUpdates } = createRequire(import.meta.url)('../desktop/client-updates.cjs')
  const resources = mkdtempSync(join(tmpdir(), 'client-info-')); roots.push(resources)
  writeFileSync(join(resources, 'desktop-release.json'), JSON.stringify({ desktopVersion: '0.5.2', studioVersion: '0.5.1', notes: '本版离线说明' }))
  const shown: { message: string, detail: string, buttons: string[] }[] = []
  const opened: string[] = []
  const action = createClientUpdates({ resources, currentVersion: '0.5.2', check,
    getWindow: () => ({ isDestroyed: () => false }),
    dialog: { showMessageBox: async (_window: unknown, options: typeof shown[number]) => {
      shown.push(options); return { response: responses.shift() ?? 0 }
    } },
    shell: { openExternal: async (url: string) => { opened.push(url) } },
  })
  return { action, shown, opened }
}

it('shows bundled desktop notes offline without querying or changing an editor package', async () => {
  const { action, shown, opened } = nativeFixture(async () => { throw new Error('Should not query') }, [0])
  expect(await action('info')).toEqual({ ok: true })
  expect(shown[0].detail).toContain('本版离线说明')
  expect(shown[0].message).toContain('0.5.2')
  expect(shown[0].detail).toContain('0.5.1')
  expect(opened).toEqual([])
})

it('opens the selected desktop release only after the user requests its notes and download', async () => {
  const { action, shown, opened } = nativeFixture(async () => ({ version: '0.6.0', notes: '新版说明' }), [1])
  expect(await action('check')).toEqual({ ok: true })
  expect(shown[0].detail).toContain('新版说明')
  expect(opened).toEqual(['https://github.com/Renko6626/slidev-addon-studio/releases/tag/desktop-v0.6.0'])
})

it('offers the fixed release page on lookup failure without claiming the client is up to date', async () => {
  const { action, shown, opened } = nativeFixture(async () => { throw new Error('HTTP 503') }, [1])
  expect((await action('check')).ok).toBe(false)
  expect(shown[0].detail).toContain('503')
  expect(opened).toEqual(['https://github.com/Renko6626/slidev-addon-studio/releases'])
})
