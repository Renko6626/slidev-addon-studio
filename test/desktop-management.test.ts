import { createRequire } from 'node:module'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, expect, it } from 'vitest'

const { createProjectManagement } = createRequire(import.meta.url)('../desktop/project-management.cjs')
const roots: string[] = []
afterEach(async () => { await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true }))) })

it('copies real compiler output and project locations while the renderer is unavailable', async () => {
  const root = await mkdtemp(join(tmpdir(), 'studio-management-')); roots.push(root)
  const logPath = join(root, 'project.log')
  await writeFile(logPath, 'Vite compiler error: components/Card.vue:12 Unexpected token')
  let copied = ''
  const manage = createProjectManagement({
    getProject: () => ({ root, entry: join(root, 'slides.md') }), getLogPath: () => logPath,
    getWindow: () => null, isWorking: () => false, recover: async () => {},
    dialog: { showMessageBox: async () => { throw new Error('Should not need a dialog') } },
    shell: {}, clipboard: { writeText: (value: string) => { copied = value } },
  })
  expect(await manage('diagnostics')).toBe(true)
  expect(copied).toBe(`Slidev Studio 工程诊断
工程目录：${root}
入口文件：${join(root, 'slides.md')}
运行日志：${logPath}

最近日志：
Vite compiler error: components/Card.vue:12 Unexpected token`)
})

it('leaves files untouched on cancel and reopens saved files after explicit confirmation without invoking renderer save', async () => {
  const root = await mkdtemp(join(tmpdir(), 'studio-management-')); roots.push(root)
  const entry = join(root, 'slides.md')
  await writeFile(entry, '# Saved content')
  let response = 0, reopened = ''
  const manage = createProjectManagement({
    getProject: () => ({ root, entry }), getLogPath: () => '', isWorking: () => false,
    getWindow: () => ({ webContents: { executeJavaScript: () => { throw new Error('Broken renderer') } } }),
    recover: async (_action: string, project: { entry: string }) => { reopened = await readFile(project.entry, 'utf8') },
    dialog: { showMessageBox: async () => ({ response }) }, shell: {}, clipboard: {},
  })
  expect(await manage('reload')).toBe(false)
  expect(reopened).toBe('')
  expect(await readFile(entry, 'utf8')).toBe('# Saved content')
  response = 1
  expect(await manage('reload')).toBe(true)
  expect(reopened).toBe('# Saved content')
})
