import { createRequire } from 'node:module'
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, expect, it } from 'vitest'

const { releaseInfo, setVersion, collectArtifacts } = createRequire(import.meta.url)('../scripts/release.cjs')
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
