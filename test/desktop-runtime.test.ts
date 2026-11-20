import { createRequire } from 'node:module'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, expect, it } from 'vitest'

const { nodeEnvironment, createRuntime } = createRequire(import.meta.url)('../desktop/runtime.cjs')
const roots: string[] = []
const runtimes: ReturnType<typeof createRuntime>[] = []
afterEach(async () => {
  await Promise.all(runtimes.splice(0).map(runtime => runtime.stop()))
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })))
})

it('accepts a healthy editor whose initial HTML response takes more than one second', async () => {
  const root = await mkdtemp(join(tmpdir(), 'studio-slow-start-'))
  roots.push(root)
  const bin = join(root, 'node_modules/@slidev/cli/bin')
  await mkdir(bin, { recursive: true })
  await writeFile(join(bin, 'slidev.mjs'), `import http from 'node:http'
const port = Number(process.argv[process.argv.indexOf('--port') + 1])
http.createServer((_req, res) => setTimeout(() => {
  res.writeHead(200, { 'Content-Type': 'text/html' }); res.end('<html>Ready</html>')
}, 1300)).listen(port, '127.0.0.1')`)
  const runtime = createRuntime({ executable: process.execPath, pnpm: '', userData: join(root, 'data') })
  runtimes.push(runtime)
  let timer: ReturnType<typeof setTimeout>
  try {
    const origin = await Promise.race([
      runtime.start({ root, entry: join(root, 'slides.md') }),
      new Promise<never>((_resolve, reject) => { timer = setTimeout(() => reject(new Error('Healthy slow editor was not accepted')), 4500) }),
    ])
    expect(origin).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/$/)
  }
  finally { clearTimeout(timer!) }
}, 10000)

it('reports editor process errors immediately instead of waiting for startup timeout', async () => {
  const root = await mkdtemp(join(tmpdir(), 'studio-failed-start-'))
  roots.push(root)
  const runtime = createRuntime({ executable: join(root, 'missing-node'), pnpm: '', userData: join(root, 'data') })
  runtimes.push(runtime)
  let timer: ReturnType<typeof setTimeout>
  try {
    await expect(Promise.race([
      runtime.start({ root, entry: join(root, 'slides.md') }),
      new Promise<never>((_resolve, reject) => { timer = setTimeout(() => reject(new Error('Spawn failure was not reported')), 1500) }),
    ])).rejects.toThrow('ENOENT')
  }
  finally { clearTimeout(timer!) }
})

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

it('keeps the offline lock and scripts disabled while letting pnpm share same-volume package files', async () => {
  const root = await mkdtemp(join(tmpdir(), 'studio-offline-install-'))
  roots.push(root)
  const project = join(root, 'project'), pnpm = join(root, 'pnpm.cjs'), storeDir = join(root, 'store')
  await mkdir(project)
  await mkdir(storeDir)
  await writeFile(pnpm, 'console.log(JSON.stringify(process.argv.slice(2)))')
  const runtime = createRuntime({ executable: process.execPath, pnpm, userData: join(root, 'data') })
  await runtime.install({ root: project }, { storeDir, offline: true })
  const log = await readFile(runtime.logPath, 'utf8')
  expect(log).toContain('"install","--offline","--frozen-lockfile","--ignore-scripts"')
  expect(log).toContain(JSON.stringify(storeDir))
  expect(log).not.toContain('package-import-method=copy')
  expect(log).not.toContain('"store","path"')
})
