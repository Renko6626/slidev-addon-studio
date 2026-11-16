import { createRequire } from 'node:module'
import { createHash } from 'node:crypto'
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, expect, it } from 'vitest'
import JSZip from 'jszip'

const { createWebPlaybackExporter, runWebPlaybackExport } = createRequire(import.meta.url)('../desktop/web-playback.cjs')
const { preparePlayback } = createRequire(import.meta.url)('../desktop/scripts/prepare-playback.cjs')
const roots: string[] = []
const exporters: { stop(): Promise<void> }[] = []
afterEach(async () => {
  await Promise.all(exporters.splice(0).map(exporter => exporter.stop()))
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })))
})

async function fixture(extra = '') {
  const root = await mkdtemp(join(tmpdir(), 'studio-playback-'))
  roots.push(root)
  const projectRoot = join(root, '我的工程'), entry = join(projectRoot, 'pages/talk.md')
  await mkdir(join(projectRoot, 'node_modules/@slidev/cli/bin'), { recursive: true })
  await mkdir(join(projectRoot, 'pages'))
  await mkdir(join(projectRoot, 'dist'))
  await writeFile(entry, '# Initial')
  await writeFile(join(projectRoot, 'package.json'), '{"private":true}')
  await writeFile(join(projectRoot, 'pnpm-lock.yaml'), 'unchanged lock')
  await writeFile(join(projectRoot, 'dist/keep.txt'), 'previous build')
  await writeFile(join(projectRoot, 'node_modules/@slidev/cli/bin/slidev.mjs'), `
import fs from 'node:fs/promises'
import path from 'node:path'
${extra}
const args = process.argv.slice(2)
const out = args[args.indexOf('--out') + 1]
await fs.mkdir(out, {recursive: true})
await fs.writeFile(path.join(out, 'index.html'), await fs.readFile(args[1]))
await fs.writeFile(path.join(out, 'clip.mp4'), Buffer.from([0,1,2,255]))
await fs.writeFile(path.join(out, 'invocation.json'), JSON.stringify({args,cwd:process.cwd(),env:process.env.NODE_ENV,pid:process.pid}))
console.log('Built presentation')
`)
  const bytes = Buffer.from('test miniserve binary')
  const asset = { version: '0.35.0', sha256: createHash('sha256').update(bytes).digest('hex'), url: 'https://unused.invalid' }
  const resources = join(root, 'resources')
  await preparePlayback({ resources, asset, fetchImpl: async () => ({ ok: true, arrayBuffer: async () => bytes }) })
  const userData = join(root, 'data')
  const exporter = createWebPlaybackExporter({ executable: process.execPath, userData, playbackAsset: asset })
  exporters.push(exporter)
  return { root, project: { root: projectRoot, entry }, resources, userData, exporter, destination: join(root, 'playback.zip') }
}

it('saves the latest draft then builds a real archive without changing project files or dist', async () => {
  const f = await fixture()
  const before = await Promise.all(['package.json', 'pnpm-lock.yaml', 'dist/keep.txt'].map(p => readFile(join(f.project.root, p), 'utf8')))
  expect(await runWebPlaybackExport({
    chooseDestination: async () => f.destination,
    save: async () => { await writeFile(f.project.entry, '# Latest draft'); return true },
    build: (target: string) => f.exporter.export(f.project, target, f.resources, join(f.userData, 'build.log')),
  })).toEqual({ ok: true })
  const zip = await JSZip.loadAsync(await readFile(f.destination))
  expect(await zip.file('web/index.html')!.async('string')).toBe('# Latest draft')
  expect(await zip.file('web/clip.mp4')!.async('nodebuffer')).toEqual(Buffer.from([0, 1, 2, 255]))
  expect(await zip.file('miniserve.exe')!.async('string')).toBe('test miniserve binary')
  expect(await zip.file('licenses/miniserve-LICENSE.txt')!.async('string')).toContain('MIT License')
  const invocation = JSON.parse(await zip.file('web/invocation.json')!.async('string'))
  expect(invocation).toMatchObject({ cwd: f.project.root, env: 'production' })
  expect(invocation.args).toEqual(['build', f.project.entry, '--base', '/', '--without-notes', '--download', 'false', '--out', expect.any(String)])
  expect(invocation.args.at(-1).startsWith(f.project.root)).toBe(false)
  expect(await Promise.all(['package.json', 'pnpm-lock.yaml', 'dist/keep.txt'].map(p => readFile(join(f.project.root, p), 'utf8')))).toEqual(before)
  await expect(readFile(join(invocation.args.at(-1), 'index.html'))).rejects.toMatchObject({ code: 'ENOENT' })
  expect(await readFile(join(f.userData, 'build.log'), 'utf8')).toContain('Built presentation')
})

it('cancellation and a failed save leave the destination and source untouched', async () => {
  const f = await fixture()
  const build = (target: string) => f.exporter.export(f.project, target, f.resources, '')
  expect(await runWebPlaybackExport({ chooseDestination: async () => null, save: async () => { await writeFile(f.project.entry, 'wrong'); return true }, build })).toEqual({ ok: false })
  expect(await readFile(f.project.entry, 'utf8')).toBe('# Initial')
  expect(await runWebPlaybackExport({ chooseDestination: async () => f.destination, save: async () => false, build })).toEqual({ ok: false })
  await expect(readFile(f.destination)).rejects.toMatchObject({ code: 'ENOENT' })
})

it('a failed build preserves an existing target and records its real process error', async () => {
  const f = await fixture("console.error('Invalid component'); process.exit(2)")
  await writeFile(f.destination, 'keep existing ZIP')
  const log = join(f.userData, 'build.log')
  const result = await runWebPlaybackExport({ chooseDestination: async () => f.destination, save: async () => true, build: (target: string) => f.exporter.export(f.project, target, f.resources, log) })
  expect(result).toMatchObject({ ok: false, error: expect.stringContaining('2') })
  expect(await readFile(f.destination, 'utf8')).toBe('keep existing ZIP')
  expect(await readFile(log, 'utf8')).toContain('Invalid component')
})

it('stops the independent build process without producing a ZIP', async () => {
  const f = await fixture("await fs.writeFile(path.join(process.cwd(), 'started'), String(process.pid)); setInterval(() => {}, 1000); await new Promise(() => {})")
  const outcome = f.exporter.export(f.project, f.destination, f.resources, '').then(() => null, (error: Error) => error)
  for (let i = 0; i < 100; i++) {
    if ((await readdir(f.project.root)).includes('started')) break
    await new Promise(resolve => setTimeout(resolve, 10))
  }
  const pid = Number(await readFile(join(f.project.root, 'started'), 'utf8'))
  expect(() => process.kill(pid, 0)).not.toThrow()
  await f.exporter.stop()
  expect(await outcome).toBeInstanceOf(Error)
  expect(() => process.kill(pid, 0)).toThrow()
  await expect(readFile(f.destination)).rejects.toMatchObject({ code: 'ENOENT' })
})
