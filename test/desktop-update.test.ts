import { createRequire } from 'node:module'
import { createHash } from 'node:crypto'
import { createServer } from 'node:http'
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, expect, it } from 'vitest'

const require = createRequire(import.meta.url)
const { createStudioPackageSource } = require('../desktop/studio-packages.cjs')
const { createProject, inspectProject } = require('../desktop/projects.cjs')
const { runStudioUpdate } = require('../desktop/studio-update.cjs')
const roots: string[] = []
const servers: ReturnType<typeof createServer>[] = []
afterEach(async () => {
  await Promise.all(servers.splice(0).map(server => new Promise<void>(resolve => { server.close(() => resolve()); server.closeAllConnections() })))
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })))
})

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'studio-update-'))
  roots.push(root)
  const resources = join(root, 'resources'), userData = join(root, 'data')
  const digest = (data: Buffer) => `sha512-${createHash('sha512').update(data).digest('base64')}`
  const name = '@renko_1055/slidev-addon-studio', bytes = Buffer.from('new release')
  await mkdir(join(resources, 'template'), { recursive: true })
  await writeFile(join(resources, 'template/slides.md'), '# User presentation')
  await writeFile(join(resources, 'slidev-addon-studio.tgz'), 'old release')
  await writeFile(join(resources, 'studio-package.json'), JSON.stringify({ name, version: '0.5.1', integrity: digest(Buffer.from('old release')) }))
  const project = await createProject(join(root, 'deck'), resources)
  await mkdir(join(project.root, 'node_modules/slidev-addon-studio'), { recursive: true })
  await writeFile(join(project.root, 'node_modules/slidev-addon-studio/package.json'), JSON.stringify({ version: '0.5.1' }))
  const server = createServer((req, res) => {
    if (req.url === '/package.tgz') { res.end(bytes); return }
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ name, version: '0.5.2', dist: { tarball: `${origin}/package.tgz`, integrity: digest(bytes) } }))
  })
  servers.push(server)
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  const origin = `http://127.0.0.1:${(server.address() as { port: number }).port}`
  return { resources, userData, project, bytes, packages: createStudioPackageSource({ resources, userData, registryUrl: origin }) }
}

it('downloads without a project, then updates only the selected project while keeping its content and dependencies', async () => {
  const app = await fixture()
  const other = await createProject(join(app.project.root, '../other'), app.resources)
  const otherManifest = await readFile(join(other.root, 'package.json'), 'utf8')
  const before = JSON.parse(await readFile(join(app.project.root, 'package.json'), 'utf8'))
  before.devDependencies.custom = '1.2.3'
  await writeFile(join(app.project.root, 'package.json'), JSON.stringify(before))
  const project = await inspectProject(app.project.entry)
  let running = 'original editor'
  const callbacks = {
    packages: app.packages, resources: app.resources,
    save: async () => true,
    stop: async () => { running = '' },
    open: async (updated: any) => { running = updated.manifest.devDependencies['slidev-addon-studio']; return true },
    confirm: async () => true,
  }
  expect(await runStudioUpdate({ ...callbacks, project: null })).toEqual({ ok: true })
  expect(running).toBe('original editor')
  expect(await readFile(join(project.root, 'package.json'), 'utf8')).toBe(JSON.stringify(before))
  expect(await runStudioUpdate({ ...callbacks, project })).toEqual({ ok: true })
  const after = JSON.parse(await readFile(join(project.root, 'package.json'), 'utf8'))
  expect(after.devDependencies).toEqual({ ...before.devDependencies, 'slidev-addon-studio': 'file:vendor/slidev-addon-studio-0.5.2.tgz' })
  expect(await readFile(project.entry, 'utf8')).toBe('# User presentation')
  expect(await readFile(join(project.root, 'vendor/slidev-addon-studio-0.5.2.tgz'))).toEqual(app.bytes)
  expect(running).toBe('file:vendor/slidev-addon-studio-0.5.2.tgz')
  expect(await readFile(join(other.root, 'package.json'), 'utf8')).toBe(otherManifest)
})

it('preserves the running project when cancelled, saving fails, or the registry is unavailable', async () => {
  const app = await fixture()
  const before = await readFile(join(app.project.root, 'package.json'), 'utf8')
  let running = true
  const callbacks = { ...app, save: async () => true, stop: async () => { running = false }, open: async () => true, confirm: async () => false }
  expect(await runStudioUpdate(callbacks)).toEqual({ ok: true })
  expect(await runStudioUpdate({ ...callbacks, confirm: async () => true, save: async () => false })).toEqual({ ok: false })
  const unavailable = createStudioPackageSource({ resources: app.resources, userData: app.userData, fetchImpl: async () => { throw new Error('offline') } })
  await expect(runStudioUpdate({ ...callbacks, packages: unavailable })).rejects.toThrow('offline')
  expect(running).toBe(true)
  expect(await readFile(join(app.project.root, 'package.json'), 'utf8')).toBe(before)
  expect(await readFile(app.project.entry, 'utf8')).toBe('# User presentation')
  expect(await readdir(join(app.project.root, 'vendor'))).toEqual(['slidev-addon-studio-0.5.1.tgz'])
})
