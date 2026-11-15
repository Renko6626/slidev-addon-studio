import type { ResolvedSlidevOptions } from '@slidev/types'
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import JSZip from 'jszip'
import { afterEach, describe, expect, it } from 'vitest'
import { exportProject, readProject } from '../node/project'

const roots: string[] = []
afterEach(async () => { await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true }))) })

async function fixture(files: Record<string, string | Buffer>, entry = 'slides.md') {
  const root = await mkdtemp(join(tmpdir(), 'studio-project-'))
  roots.push(root)
  for (const [name, data] of Object.entries(files)) {
    await mkdir(dirname(join(root, name)), { recursive: true })
    await writeFile(join(root, name), data)
  }
  const options = {
    entry: join(root, entry), userRoot: dirname(join(root, entry)), userWorkspaceRoot: root,
    data: { config: { title: '我的演示' }, slides: [{ source: { filepath: join(root, entry) } }] },
  } as unknown as ResolvedSlidevOptions
  return { root, options }
}

describe('directory projects', () => {
  it('uses the nearest package directory for a nested entry without exporting its monorepo', async () => {
    const { root, options } = await fixture({
      'package.json': '{"private":true}', 'other-project/private.md': 'Other project',
      'decks/demo/package.json': '{"name":"demo"}', 'decks/demo/pages/talk.md': '# Talk',
    }, 'decks/demo/pages/talk.md')
    const info = await readProject(options)
    expect(info.root).toBe(join(root, 'decks/demo'))
    expect(info.entry).toBe('pages/talk.md')
    expect(info.name).toBe('我的演示')
    const zip = await JSZip.loadAsync((await exportProject(options)).data)
    expect(Object.keys(zip.files).filter(name => !zip.files[name].dir).sort()).toEqual(['package.json', 'pages/talk.md'])
  })

  it('supports a plain deck without Git, a package manifest or workbench metadata', async () => {
    const { root, options } = await fixture({ 'slides.md': '# Plain deck', 'public/picture.svg': '<svg />' })
    const info = await readProject(options)
    expect(info.root).toBe(root)
    expect(info.entry).toBe('slides.md')
    expect(info.files.some(file => file.name === 'public' && file.children?.[0].path === 'public/picture.svg')).toBe(true)
  })

  it('archives current source and binary assets while excluding local credentials, dependencies and output', async () => {
    const image = Buffer.from([0, 255, 1, 128])
    const { root, options } = await fixture({
      'package.json': '{"name":"demo"}', 'pnpm-lock.yaml': 'lockfileVersion: 9',
      'slides.md': '# Old', 'parts/新增.md': '# Uncommitted', 'public/图片.png': image,
      'patches/slidev.patch': 'patch content', '.gitignore': 'node_modules/', '.env.example': 'TOKEN=',
      '.env': 'TOKEN=secret', '.env.local': 'TOKEN=private', '.npmrc': '//registry/:_authToken=secret',
      '.git/config': 'credential', 'node_modules/package/index.js': 'dependency', 'dist/index.html': 'built',
      '.vite/cache': 'cache', '.worktrees/other/slides.md': 'Other worktree',
    })
    await writeFile(join(root, 'slides.md'), '# Saved now')
    const archive = await exportProject(options)
    expect(archive.filename).toBe('我的演示.zip')
    const zip = await JSZip.loadAsync(archive.data)
    expect(Object.keys(zip.files).filter(name => !zip.files[name].dir).sort()).toEqual([
      '.env.example', '.gitignore', 'package.json', 'parts/新增.md', 'patches/slidev.patch',
      'pnpm-lock.yaml', 'public/图片.png', 'slides.md',
    ].sort())
    expect(await zip.file('slides.md')!.async('string')).toBe('# Saved now')
    expect(await zip.file('public/图片.png')!.async('nodebuffer')).toEqual(image)
    expect(await readFile(join(root, '.env'), 'utf8')).toBe('TOKEN=secret')
  })

  it('rejects linked source instead of silently omitting it or reading files outside the project', async () => {
    const { root, options } = await fixture({ 'slides.md': '# Deck', 'real.md': '# Linked' })
    await symlink(join(root, 'real.md'), join(root, 'linked.md'))
    await expect(exportProject(options)).rejects.toMatchObject({ code: 'projectLinkedFile', params: { path: 'linked.md' } })
  })

  it('rejects imported slides outside the project rather than exporting an incomplete deck', async () => {
    const { root, options } = await fixture({ 'slides.md': '# Deck' })
    options.data.slides.push({ source: { filepath: join(root, '../outside.md') } } as any)
    await expect(exportProject(options)).rejects.toMatchObject({ code: 'projectExternalSource' })
  })
})
