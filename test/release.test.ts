import { createRequire } from 'node:module'
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, expect, it } from 'vitest'

const { releaseInfo, setVersion, collectArtifacts, publish } = createRequire(import.meta.url)('../scripts/release.cjs')
const roots: string[] = []
afterEach(() => roots.splice(0).forEach(root => rmSync(root, { recursive: true, force: true })))
function fixture() {
  const parent = mkdtempSync(join(tmpdir(), 'studio-release-'))
  roots.push(parent)
  const root = join(parent, 'repo')
  mkdirSync(join(root, 'desktop'), { recursive: true })
  writeFileSync(join(root, 'package.json'), JSON.stringify({ version: '0.4.0-renko.1', name: 'addon' }))
  writeFileSync(join(root, 'desktop/package.json'), JSON.stringify({ version: '0.2.1-offline.1', name: 'desktop' }))
  return root
}

it('sets the requested version independently, preserving fields and rejecting non-X.Y.Z versions', () => {
  const root = fixture()
  setVersion(root, 'studio', '0.6.0')
  expect(JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))).toEqual({ name: 'addon', version: '0.6.0' })
  expect(JSON.parse(readFileSync(join(root, 'desktop/package.json'), 'utf8'))).toEqual({ name: 'desktop', version: '0.2.1-offline.1' })
  setVersion(root, 'desktop', '0.5.0')
  expect(JSON.parse(readFileSync(join(root, 'desktop/package.json'), 'utf8'))).toEqual({ name: 'desktop', version: '0.5.0' })
  expect(() => setVersion(root, 'studio', '0.5.0-offline.1')).toThrow('X.Y.Z')
  expect(() => setVersion(root, 'desktop', '01.5.0')).toThrow('X.Y.Z')
  expect(releaseInfo(root)).toMatchObject({ studioVersion: '0.6.0', desktopVersion: '0.5.0' })
})

function readyRelease(offline = false) {
  const root = fixture()
  setVersion(root, 'studio', '0.5.2'); setVersion(root, 'desktop', '0.8.0')
  mkdirSync(join(root, 'docs/releases'), { recursive: true })
  writeFileSync(join(root, 'docs/releases/desktop-0.8.0.md'), '# Desktop 0.8.0\n\nUser notes\n')
  const info = releaseInfo(root, offline)
  mkdirSync(join(root, 'desktop/out/make/zip/win32/x64'), { recursive: true })
  mkdirSync(join(root, 'desktop/studio-resources'), { recursive: true })
  writeFileSync(info.sourceZip, 'portable fixture'); writeFileSync(info.sourceAddon, 'published addon fixture')
  collectArtifacts(info)
  return { root, info }
}

it('requires desktop notes before invoking GitHub, including in publish dry runs', () => {
  const { root, info } = readyRelease()
  rmSync(join(root, 'docs/releases/desktop-0.8.0.md'))
  expect(() => publish(info, true, () => { throw new Error('Must not invoke GitHub') })).toThrow('desktop-0.8.0.md')
})

it('creates a prerelease with user notes and verified portable artifacts by default', () => {
  const { root, info } = readyRelease()
  const calls: string[][] = []
  publish(info, false, (_command: string, args: string[]) => {
    calls.push(args)
    return args[1] === 'view' ? { status: 1, stdout: '' } : { status: 0 }
  })
  expect(calls[1]).toEqual(['release', 'create', 'desktop-v0.8.0', info.zip, info.addon, info.checksums,
    '--repo', 'Renko6626/slidev-addon-studio', '--verify-tag', '--title', 'Desktop 0.8.0',
    '--notes-file', join(root, 'docs/releases/desktop-0.8.0.md'), '--prerelease', '--latest=false'])
})

it('adds offline files to an existing release without changing its stable status or replacing assets', () => {
  const { info } = readyRelease(true)
  const calls: string[][] = []
  publish(info, false, (_command: string, args: string[]) => {
    calls.push(args)
    return { status: 0, stdout: JSON.stringify({ assets: [
      { name: 'slidev-addon-studio-0.5.2.tgz' }, { name: 'Slidev-Studio-0.8.0-win32-x64-online.zip' },
    ] }) }
  })
  expect(calls[1]).toEqual(['release', 'upload', 'desktop-v0.8.0', info.zip, info.checksums, '--repo', 'Renko6626/slidev-addon-studio'])
  expect(calls).toHaveLength(2)
})

it('keeps upload dry runs offline and requires the lightweight release before an offline-only upload', () => {
  const { info } = readyRelease(true)
  expect(() => publish(info, true, () => { throw new Error('Must not invoke GitHub') })).not.toThrow()
  expect(() => publish(info, false, () => ({ status: 1, stdout: '' }))).toThrow('轻量版')
})

it('requires valid release versions while allowing the shell and Studio to differ', () => {
  const root = fixture()
  setVersion(root, 'studio', '0.6.0')
  expect(() => releaseInfo(root)).toThrow('X.Y.Z')
  setVersion(root, 'desktop', '0.5.0')
  expect(releaseInfo(root).addon).toBe(join(root, '../release/studio/0.5.0/slidev-addon-studio-0.6.0.tgz'))
})

it('collects online and offline artifacts under one version without overwriting the other ZIP', () => {
  const root = fixture()
  setVersion(root, 'studio', '0.6.0')
  setVersion(root, 'desktop', '0.5.0')
  const online = releaseInfo(root)
  mkdirSync(join(root, 'desktop/out/make/zip/win32/x64'), { recursive: true })
  mkdirSync(join(root, 'desktop/studio-resources'), { recursive: true })
  writeFileSync(online.sourceZip, 'online bytes')
  writeFileSync(online.sourceAddon, 'addon bytes')
  collectArtifacts(online)
  const offline = releaseInfo(root, true)
  writeFileSync(offline.sourceZip, 'offline bytes')
  collectArtifacts(offline)
  expect(readFileSync(online.zip, 'utf8')).toBe('online bytes')
  expect(readFileSync(offline.zip, 'utf8')).toBe('offline bytes')
  expect(readFileSync(online.addon, 'utf8')).toBe('addon bytes')
  expect(readFileSync(online.checksums, 'utf8')).toContain('  Slidev-Studio-0.5.0-win32-x64-online.zip\n')
  expect(readFileSync(offline.checksums, 'utf8')).toContain('  Slidev-Studio-0.5.0-win32-x64-offline.zip\n')
  expect(online.directory).toBe(join(root, '../release/studio/0.5.0'))
})
