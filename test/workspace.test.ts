import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, it } from 'vitest'
import { readWorkspaceContext } from '../node/workspace'
import { returnToActivity } from '../client/workspace'

it('reads optional workspace context without accepting executable or credential-bearing links', () => {
  expect(readWorkspaceContext(undefined)).toBeUndefined()
  expect(readWorkspaceContext('{')).toBeUndefined()
  expect(readWorkspaceContext(JSON.stringify({ name: '春季活动', returnUrl: 'https://workbench.example/projects/123' }))).toEqual({ name: '春季活动', returnUrl: 'https://workbench.example/projects/123' })
  for (const returnUrl of ['javascript:alert(1)', 'file:///tmp/deck', 'https://user:password@example.com/'])
    expect(readWorkspaceContext(JSON.stringify({ name: '活动', returnUrl }))).toBeUndefined()
})

it('returns to the activity only after the current draft has been saved', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'studio-workspace-return-'))
  const file = join(directory, 'slides.md')
  let destination = '', savedAtNavigation = ''
  const navigate = async (url: string) => { destination = url; savedAtNavigation = await readFile(file, 'utf8') }
  const workspace = { name: '活动', returnUrl: 'https://workbench.example/projects/123' }
  try {
    await returnToActivity(workspace, async () => false, navigate)
    expect(destination).toBe('')
    await returnToActivity(workspace, async () => { await writeFile(file, '# Saved draft'); return true }, navigate)
    expect(destination).toBe(workspace.returnUrl)
    expect(savedAtNavigation).toBe('# Saved draft')
  }
  finally { await rm(directory, { recursive: true, force: true }) }
})
