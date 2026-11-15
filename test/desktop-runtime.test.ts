import { createRequire } from 'node:module'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, expect, it } from 'vitest'

const { nodeEnvironment } = createRequire(import.meta.url)('../desktop/runtime.cjs')
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
