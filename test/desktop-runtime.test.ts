import { createRequire } from 'node:module'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, expect, it } from 'vitest'

const { nodeEnvironment, createRuntime } = createRequire(import.meta.url)('../desktop/runtime.cjs')
const roots: string[] = []
afterEach(async () => { await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true }))) })

it('creates a Windows node command bridge to the application exe without shipping another runtime', async () => {
  const root = await mkdtemp(join(tmpdir(), 'studio-node-bridge-'))
  roots.push(root)
  const executable = 'C:\\Program Files\\Studio\\Studio.exe'
  const env = await nodeEnvironment(executable, root, 'win32', { PATH: 'C:\\Windows\\System32', SystemRoot: 'C:\\Windows' })
  const bridge = await readFile(join(root, 'runtime-bin/node.cmd'), 'utf8')
  expect(bridge).toContain('"C:\\Program Files\\Studio\\Studio.exe" %*')
  expect(env.ELECTRON_RUN_AS_NODE).toBe('1')
  expect(env.PATH).toBe(join(root, 'runtime-bin') + ';C:\\Windows\\System32')
  expect(env.SystemRoot).toBe('C:\\Windows')
})

it('reports complete dependency output lines while retaining stdout and stderr in the project log', async () => {
  const root = await mkdtemp(join(tmpdir(), 'studio-install-progress-'))
  roots.push(root)
  const project = join(root, 'project'), pnpm = join(root, 'pnpm.cjs')
  await mkdir(project)
  await writeFile(pnpm, `process.stdout.write('Progress: resolved 12, reused 3, down');
setTimeout(() => {
  process.stdout.write('loaded 5, added 2\\n');
  process.stderr.write('Preparing packages\\n');
}, 20)`)
  const updates: { message: string, detail?: string }[] = []
  const runtime = createRuntime({ executable: process.execPath, pnpm, userData: join(root, 'data'), onStatus: (update: any) => updates.push(update) })
  await runtime.install({ root: project })
  expect(updates.some(update => update.detail === '已解析 12 个包，复用 3，下载 5，安装 2')).toBe(true)
  expect(updates.some(update => update.detail === 'Preparing packages')).toBe(true)
  const log = await readFile(runtime.logPath, 'utf8')
  expect(log).toContain('Progress: resolved 12, reused 3, downloaded 5, added 2')
  expect(log).toContain('Preparing packages')
})
