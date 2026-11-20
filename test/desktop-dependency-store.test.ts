import { accessSync, constants, statSync } from 'node:fs'
import { chmod, mkdir, mkdtemp, readFile, readdir, rm, stat, symlink, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, expect, it, vi } from 'vitest'

const require = createRequire(import.meta.url)
const { selectDependencyStore, writeStoreSeed } = require('../desktop/dependency-store.cjs')
const { createRuntime } = require('../desktop/runtime.cjs')

const roots: string[] = []
afterEach(async () => {
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })))
})

function otherVolume() {
  for (const directory of ['/dev/shm', process.cwd()]) {
    try {
      if (statSync(directory).dev === statSync(tmpdir()).dev) continue
      accessSync(directory, constants.W_OK)
      return directory
    }
    catch {}
  }
  return null
}

const volume = otherVolume()
const shared = 'files/aa/abcd'
const content = 'files/bb/bcde-exec'
const index = 'index/aa/abcd-@scope+pkg@1.0.0.json'
const tarball = 'file+vendor+slidev-addon-studio-0.5.3.tgz/tarball-integrity'
const unlisted = 'files/aa/eeee'

async function put(file: string, value: string) {
  await mkdir(dirname(file), { recursive: true })
  await writeFile(file, value)
}

async function fixture() {
  const source = await mkdtemp(join(tmpdir(), 'studio-seed-source-'))
  roots.push(source)
  const target = await mkdtemp(join(volume!, 'studio-seed-target-'))
  roots.push(target)
  const storeDir = join(source, 'store')
  const sourceStore = join(storeDir, 'v10')
  const destination = join(target, 'pnpm-store/v10')
  const first = join(target, 'presentations', 'first')
  const second = join(target, 'archive', 'second')
  await put(join(source, 'pnpm-lock.yaml'), 'lockfileVersion: 9.0')
  await put(join(sourceStore, shared), 'shared package content')
  await put(join(sourceStore, content), 'another file')
  await put(join(sourceStore, index), '{}')
  await put(join(sourceStore, tarball), 'sha512-integrity')
  await writeStoreSeed(storeDir, { platform: 'win32', arch: 'x64' })
  await put(join(sourceStore, unlisted), 'cached after release')
  await mkdir(first, { recursive: true })
  await mkdir(second, { recursive: true })
  const select = (projectRoot = first, storePath = destination) => selectDependencyStore({
    projectRoot, storeDir, queryStore: async () => storePath, onPrepare: () => {},
  })
  return { source, sourceStore, storeDir, target, destination, first, second, select }
}

it.skipIf(!volume)('publishes a cross-volume baseline concurrently and preserves existing index data', async () => {
  const { select, first, second, destination, sourceStore } = await fixture()
  await put(join(destination, index), '{"sideEffects":{"local":{}}}')
  const results = await Promise.all([select(first), select(second)])
  expect(results.map(result => result.storeDir)).toEqual([destination, destination])
  expect(results[0].marker).toBe(results[1].marker)
  expect(await readFile(join(destination, index), 'utf8')).toBe('{"sideEffects":{"local":{}}}')
  expect(await readFile(join(destination, shared), 'utf8')).toBe('shared package content')
  expect(await readFile(join(destination, tarball), 'utf8')).toBe('sha512-integrity')
  await expect(stat(join(destination, unlisted))).rejects.toMatchObject({ code: 'ENOENT' })
  await rm(sourceStore, { recursive: true })
  expect(await select(second)).toMatchObject({ storeDir: destination, detail: '复用目标卷中已准备的随附依赖。' })
})

it.skipIf(!volume)('resumes a partial fill after a missing source file, publishing indexes last', async () => {
  const { storeDir, select, destination, sourceStore } = await fixture()
  await rm(join(sourceStore, content))
  expect(await select()).toMatchObject({ storeDir, detail: expect.stringContaining('ENOENT') })
  await expect(stat(join(destination, index))).rejects.toMatchObject({ code: 'ENOENT' })
  const previous = await stat(join(destination, shared))
  await put(join(sourceStore, content), 'another file')
  expect(await select()).toMatchObject({ storeDir: destination, detail: expect.stringContaining('3 个') })
  expect((await stat(join(destination, shared))).ino).toBe(previous.ino)
})

it.skipIf(!volume)('falls back without creating a store inside the project or on the wrong volume', async () => {
  const { source, storeDir, target, first, select } = await fixture()
  const internal = join(first, 'configured/v10')
  expect(await select(first, internal)).toMatchObject({ storeDir, detail: expect.stringContaining('重叠') })
  await expect(stat(dirname(internal))).rejects.toMatchObject({ code: 'ENOENT' })
  const different = join(source, 'configured/v10')
  expect(await select(first, different)).toMatchObject({ storeDir, detail: expect.stringContaining('不在同一卷') })

  const link = join(target, 'redirect')
  await symlink(first, link, 'junction')
  expect(await select(first, join(link, 'v10'))).toMatchObject({ storeDir, detail: expect.stringContaining('重叠') })

  await writeFile(join(target, 'blocked'), 'not a directory')
  expect(await select(first, join(target, 'blocked/v10'))).toMatchObject({ storeDir, detail: expect.stringContaining('ENOTDIR') })

  if (process.platform !== 'win32' && process.getuid?.() !== 0) {
    const unwritable = join(target, 'read-only')
    await mkdir(unwritable)
    await chmod(unwritable, 0o555)
    try {
      expect(await select(first, join(unwritable, 'v10'))).toMatchObject({ storeDir, detail: expect.stringContaining('EACCES') })
    }
    finally { await chmod(unwritable, 0o755) }
  }

  await rm(join(source, 'store-seed.json'))
  expect(await select()).toMatchObject({ storeDir, detail: expect.stringContaining('没有跨卷文件清单') })
})

it.skipIf(!volume)('invalidates a stale receipt when pnpm reports a missing offline package and repairs it on reopen', async () => {
  const { source, storeDir, destination, first, second } = await fixture()
  const pnpm = join(source, 'pnpm.cjs')
  const createFixtureRuntime = (project: string) => createRuntime({ executable: process.execPath, pnpm, userData: join(project, 'user-data') })
  for (const project of [first, second]) await writeFile(join(project, 'store-location'), destination)
  await writeFile(pnpm, `
    const fs = require('node:fs')
    const path = require('node:path')
    const args = process.argv.slice(2)
    if (args.includes('store')) {
      if (!process.env.NODE || !fs.existsSync('store-location')) process.exit(9)
      console.log(fs.readFileSync('store-location', 'utf8'))
    }
    else {
      const store = args[args.indexOf('--store-dir') + 1]
      if (!fs.existsSync(path.join(store, ${JSON.stringify(shared)}))) {
        console.error('ERR_PNPM_NO_OFFLINE_TARBALL')
        process.exitCode = 1
      }
    }
  `)
  await createFixtureRuntime(first).install({ root: first }, { storeDir, offline: true })
  await rm(join(destination, shared))
  const runtime = createFixtureRuntime(second)
  await expect(runtime.install({ root: second }, { storeDir, offline: true })).rejects.toThrow('退出码 1')
  expect(await readFile(runtime.logPath, 'utf8')).toContain('已清除完成标记')
  expect((await readdir(destination)).every(entry => !entry.startsWith('.slidev-studio-seed-'))).toBe(true)
  await runtime.install({ root: second }, { storeDir, offline: true })
  expect(await readFile(join(destination, shared), 'utf8')).toBe('shared package content')
  expect(await readFile(runtime.logPath, 'utf8')).toContain('补齐 1 个')
})

it.skipIf(!volume)('reports disk exhaustion during a fill and leaves it available for manual retry', async () => {
  const { destination, select } = await fixture()
  const copy = vi.spyOn(require('node:fs/promises'), 'copyFile')
  copy.mockRejectedValueOnce(Object.assign(new Error('ENOSPC: no space left on device'), { code: 'ENOSPC' }))
  try {
    await expect(select()).rejects.toThrow('ENOSPC')
    expect((await readdir(destination)).every(entry => !entry.startsWith('.slidev-studio-seed-'))).toBe(true)
  }
  finally { copy.mockRestore() }
  expect(await select()).toMatchObject({ storeDir: destination })
})

it.skipIf(!volume)('repairs a missing native package index or companion file before calling pnpm', async () => {
  const { sourceStore, storeDir, destination, select } = await fixture()
  const nativeFiles = {
    'binding.node': { mode: 0o755, payload: 'native binary' },
    'package.json': { mode: 0o644, payload: '{"name":"native-fixture"}' },
  }
  const files = Object.fromEntries(await Promise.all(Object.entries(nativeFiles).map(async ([name, { mode, payload }]) => {
    const digest = createHash('sha512').update(payload).digest()
    const hex = digest.toString('hex')
    const relative = `files/${hex.slice(0, 2)}/${hex.slice(2)}${mode & 0o111 ? '-exec' : ''}`
    await put(join(sourceStore, relative), payload)
    return [name, { mode, integrity: `sha512-${digest.toString('base64')}`, relative }]
  })))
  await put(join(sourceStore, index), JSON.stringify({ files }))
  await writeStoreSeed(storeDir, { platform: 'win32', arch: 'x64' })
  await select()
  for (const relative of [index, files['package.json'].relative]) {
    const file = join(destination, relative)
    const original = await readFile(file, 'utf8')
    await rm(file)
    expect(await select()).toMatchObject({ storeDir: destination, detail: expect.stringContaining('补齐 1 个') })
    expect(await readFile(file, 'utf8')).toBe(original)
  }
})

it.skipIf(!volume)('waits for seed cleanup on stop and never launches pnpm install', async () => {
  const { source, storeDir, destination, first } = await fixture()
  const pnpm = join(source, 'pnpm.cjs')
  const installed = join(source, 'installed')
  await writeFile(pnpm, `
    if (process.argv.includes('store')) console.log(${JSON.stringify(destination)})
    else require('node:fs').writeFileSync(${JSON.stringify(installed)}, '')
  `)
  let copying!: () => void
  let resumeCopy!: () => void
  const started = new Promise<void>(resolve => { copying = resolve })
  const resume = new Promise<void>(resolve => { resumeCopy = resolve })
  const fs = require('node:fs/promises')
  const copyFile = fs.copyFile
  const copy = vi.spyOn(fs, 'copyFile').mockImplementationOnce(async (...args: any[]) => {
    copying()
    await resume
    return copyFile(...args)
  })
  const runtime = createRuntime({ executable: process.execPath, pnpm, userData: join(source, 'user-data') })
  const handlingInstall = runtime.install({ root: first }, { storeDir, offline: true }).catch((error: Error) => error)
  let stopped = false
  try {
    await started
    const stopping = runtime.stop().then(() => { stopped = true })
    await new Promise(resolve => setImmediate(resolve))
    expect(stopped).toBe(false)
    resumeCopy()
    await stopping
    expect((await handlingInstall).message).toContain('已取消')
    await expect(stat(installed)).rejects.toMatchObject({ code: 'ENOENT' })
    expect((await readdir(destination)).some(entry => entry.startsWith('.slidev-studio-seed-'))).toBe(false)
    expect((await readdir(first)).some(entry => entry.startsWith('.slidev-studio-link-'))).toBe(false)
  }
  finally {
    resumeCopy()
    await handlingInstall
    copy.mockRestore()
  }
})
