import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, expect, it } from 'vitest'
import { projectSavedAt, projectSaveStatus, projectWriteError, saveProject, trackProjectWrite } from '../client/project-save'

const roots: string[] = []
afterEach(async () => {
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })))
  projectSavedAt.value = null
  projectWriteError.value = null
})

it('applies a draft and waits for the actual file write before reporting saved', async () => {
  const root = await mkdtemp(join(tmpdir(), 'studio-save-'))
  roots.push(root)
  let release!: () => void
  const ready = new Promise<void>(resolve => { release = resolve })
  const saving = saveProject(async () => {
    await trackProjectWrite(async () => { await ready; await writeFile(join(root, 'slides.md'), '# Saved draft') })
  })
  expect(projectSaveStatus()).toBe('projectSaving')
  expect(projectSavedAt.value).toBeNull()
  release()
  expect(await saving).toBe(true)
  expect(await readFile(join(root, 'slides.md'), 'utf8')).toBe('# Saved draft')
  expect(projectSaveStatus()).toBe('projectSaved')
  expect(projectSaveStatus(true)).toBe('projectDraft')
})

it('waits for an automatic write already in progress before saving', async () => {
  let release!: () => void
  const gate = new Promise<void>(resolve => { release = resolve })
  let persisted = false
  const writing = trackProjectWrite(async () => { await gate; persisted = true })
  const saving = saveProject()
  expect(persisted).toBe(false)
  release()
  await writing
  expect(await saving).toBe(true)
  expect(persisted).toBe(true)
})

it('keeps a real write failure visible and refuses to report a later no-op save as successful', async () => {
  const root = await mkdtemp(join(tmpdir(), 'studio-save-'))
  roots.push(root)
  expect(await saveProject(() => trackProjectWrite(() => writeFile(join(root, 'missing/slides.md'), '# Draft')))).toBe(false)
  expect(projectSaveStatus()).toBe('projectSaveFailed')
  expect(projectSavedAt.value).toBeNull()
  expect(await saveProject()).toBe(false)
  expect(projectWriteError.value).toContain('ENOENT')
})

it('records errors from applying the active editor instead of exporting unapplied content', async () => {
  expect(await saveProject(async () => { throw new Error('Unable to apply text') })).toBe(false)
  expect(projectWriteError.value).toBe('Unable to apply text')
  expect(projectSaveStatus()).toBe('projectSaveFailed')
})
