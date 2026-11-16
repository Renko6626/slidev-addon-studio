import { createRequire } from 'node:module'
import { createHash } from 'node:crypto'
import { createServer } from 'node:http'
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, expect, it } from 'vitest'

const { createStudioPackageSource, compareStudioVersions, readBundledStudio } = createRequire(import.meta.url)('../desktop/studio-packages.cjs')
const name = '@renko_1055/slidev-addon-studio'
const roots: string[] = []
const servers: ReturnType<typeof createServer>[] = []
const integrity = (bytes: Buffer) => `sha512-${createHash('sha512').update(bytes).digest('base64')}`
afterEach(async () => {
  await Promise.all(servers.splice(0).map(server => new Promise<void>((resolve, reject) => { server.close(error => error ? reject(error) : resolve()); server.closeAllConnections() })))
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })))
})

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'studio-packages-'))
  roots.push(root)
  const resources = join(root, 'resources'), userData = join(root, 'data')
  await mkdir(resources)
  const bytes = Buffer.from('bundled 0.5.1')
  await writeFile(join(resources, 'slidev-addon-studio.tgz'), bytes)
  await writeFile(join(resources, 'studio-package.json'), JSON.stringify({ name, version: '0.5.1', integrity: integrity(bytes) }))
  return { root, resources, userData }
}

async function registry(bytes: Buffer, digest = integrity(bytes)) {
  const server = createServer((req, res) => {
    if (req.url === '/studio.tgz') { res.end(bytes); return }
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ name, version: '0.5.2', dist: { tarball: `${origin}/studio.tgz`, integrity: digest } }))
  })
  servers.push(server)
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  const origin = `http://127.0.0.1:${(server.address() as { port: number }).port}`
  return origin
}

it('compares numeric releases and chooses a newer local archive over the bundled version', async () => {
  expect(compareStudioVersions('0.10.0', '0.9.9')).toBe(1)
  expect(compareStudioVersions('1.0.0', '1.0.0')).toBe(0)
  const { resources, userData } = await fixture()
  await mkdir(join(userData, 'studio-packages'), { recursive: true })
  const archive = join(userData, 'studio-packages/slidev-addon-studio-0.5.2.tgz')
  await writeFile(archive, 'cached 0.5.2')
  expect(await createStudioPackageSource({ resources, userData }).local()).toMatchObject({ name, version: '0.5.2', archive })
  expect(await readBundledStudio(resources)).toMatchObject({ version: '0.5.1' })
})

it('checks without installing, then downloads the exact bytes and reuses the verified archive', async () => {
  const { resources, userData } = await fixture()
  const bytes = Buffer.from('downloaded release bytes')
  const source = createStudioPackageSource({ resources, userData, registryUrl: await registry(bytes) })
  const release = await source.check()
  expect(release).toMatchObject({ name, version: '0.5.2', integrity: integrity(bytes) })
  await expect(readdir(userData)).rejects.toMatchObject({ code: 'ENOENT' })
  const acquired = await source.acquire(release)
  expect(await readFile(acquired.archive)).toEqual(bytes)
  expect(await source.acquire(release)).toEqual(acquired)
  expect((await source.local()).version).toBe('0.5.2')
})

it('does not expose a download with the wrong integrity as an available package', async () => {
  const { resources, userData } = await fixture()
  const source = createStudioPackageSource({ resources, userData, registryUrl: await registry(Buffer.from('damaged bytes'), integrity(Buffer.from('expected bytes'))) })
  await expect(source.acquire(await source.check())).rejects.toThrow('校验')
  expect((await source.local()).version).toBe('0.5.1')
})

it('prepares the precise published artifact and its descriptor without repacking workspace source', async () => {
  const { root, resources } = await fixture()
  const { prepare } = createRequire(import.meta.url)('../desktop/scripts/prepare.cjs')
  await mkdir(join(root, 'desktop/template'), { recursive: true })
  await writeFile(join(root, 'desktop/template/slides.md'), '# Template')
  await writeFile(join(root, 'package.json'), JSON.stringify({ name, version: '0.5.2' }))
  const bytes = Buffer.from('canonical published artifact')
  await prepare({ root, resources, source: 'published', registryUrl: await registry(bytes) })
  expect(await readFile(join(resources, 'slidev-addon-studio.tgz'))).toEqual(bytes)
  expect(await readBundledStudio(resources)).toMatchObject({ name, version: '0.5.2', integrity: integrity(bytes) })
  expect(await readFile(join(resources, 'template/slides.md'), 'utf8')).toBe('# Template')
})

it('stops a formal build when its exact Studio version is unavailable, keeping the old bundled artifact', async () => {
  const { root, resources } = await fixture()
  const { prepare } = createRequire(import.meta.url)('../desktop/scripts/prepare.cjs')
  await writeFile(join(root, 'package.json'), JSON.stringify({ name, version: '0.5.2' }))
  await expect(prepare({ root, resources, source: 'published', fetchImpl: async () => ({ ok: false, status: 404 }) })).rejects.toThrow('404')
  expect((await readBundledStudio(resources)).version).toBe('0.5.1')
})
