import { createRequire } from 'node:module'
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import JSZip from 'jszip'
import { afterEach, expect, it } from 'vitest'

const { createProject, enableStudio, hasBundledStudio, inspectProject, saveProjectCopy } = createRequire(import.meta.url)('../desktop/projects.cjs')
const roots: string[] = []
afterEach(async () => { await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true }))) })

async function temporary() {
  const root = await mkdtemp(join(tmpdir(), 'studio-desktop-'))
  roots.push(root)
  return root
}
async function resources(root: string) {
  const path = join(root, 'resources')
  await mkdir(join(path, 'template'), { recursive: true })
  await writeFile(join(path, 'template/slides.md'), '# New presentation')
  await writeFile(join(path, 'template/.gitignore'), 'node_modules/\n')
  await writeFile(join(path, 'slidev-addon-studio.tgz'), 'bundled-addon-bytes')
  return path
}

it('creates an ordinary Slidev project with a portable local addon and no Git requirement', async () => {
  const root = await temporary()
  const assets = await resources(root)
  const project = await createProject(join(root, '我的演示'), assets)
  const manifest = JSON.parse(await readFile(join(project.root, 'package.json'), 'utf8'))
  expect(manifest.devDependencies['@slidev/cli']).toBe('52.19.0')
  expect(manifest.devDependencies['markdown-it']).toBe('14.3.0')
  expect(manifest.devDependencies['slidev-addon-studio']).toBe('file:vendor/slidev-addon-studio.tgz')
  expect(manifest.slidev.addons).toEqual(['slidev-addon-studio'])
  expect(await readFile(project.entry, 'utf8')).toBe('# New presentation')
  expect(await hasBundledStudio(project, assets)).toBe(true)
  expect((await readdir(project.root)).includes('.git')).toBe(false)
  await expect(createProject(project.root, assets)).rejects.toThrow('非空')
})

it('enables the bundled addon while preserving the project CLI, other dependencies and metadata', async () => {
  const root = await temporary()
  const assets = await resources(root)
  const projectRoot = join(root, 'deck')
  await mkdir(join(projectRoot, 'pages'), { recursive: true })
  await writeFile(join(projectRoot, 'pages/talk.md'), '# Keep this text')
  await writeFile(join(projectRoot, 'package.json'), JSON.stringify({
    name: 'existing', dependencies: { '@slidev/cli': '53.0.0', 'slidev-addon-studio': 'old-version', vue: '3.5.42' },
    slidev: { addons: ['other-addon'] }, custom: { keep: true },
  }))
  const project = await inspectProject(join(projectRoot, 'pages/talk.md'))
  expect(project.root).toBe(projectRoot)
  expect(await hasBundledStudio(project, assets)).toBe(false)
  await enableStudio(project, assets)
  const manifest = JSON.parse(await readFile(join(projectRoot, 'package.json'), 'utf8'))
  expect(manifest.dependencies).toEqual({ '@slidev/cli': '53.0.0', 'slidev-addon-studio': 'file:vendor/slidev-addon-studio.tgz', vue: '3.5.42' })
  expect(manifest.slidev.addons).toEqual(['other-addon', 'slidev-addon-studio'])
  expect(manifest.custom).toEqual({ keep: true })
  expect(await readFile(project.entry, 'utf8')).toBe('# Keep this text')
  expect(await hasBundledStudio(project, assets)).toBe(true)
})

it('saves an independent archive copy without overwriting files or nesting it in the source project', async () => {
  const root = await temporary()
  const source = join(root, 'source')
  await mkdir(source)
  const zip = new JSZip()
  zip.file('slides.md', '# Latest edit')
  zip.file('public/图片.png', Buffer.from([0, 255, 1]))
  const data = await zip.generateAsync({ type: 'nodebuffer' })
  const target = join(root, 'copy')
  await saveProjectCopy(data, target, source)
  expect(await readFile(join(target, 'slides.md'), 'utf8')).toBe('# Latest edit')
  expect(await readFile(join(target, 'public/图片.png'))).toEqual(Buffer.from([0, 255, 1]))
  await expect(saveProjectCopy(data, target, source)).rejects.toThrow('非空')
  await expect(saveProjectCopy(data, join(source, 'nested'), source)).rejects.toThrow('工程内部')
})

it('rejects archive paths that escape the chosen copy directory before writing any files', async () => {
  const root = await temporary()
  const zip = new JSZip()
  zip.file('../outside.md', 'must not escape')
  const target = join(root, 'copy')
  await expect(saveProjectCopy(await zip.generateAsync({ type: 'nodebuffer' }), target, join(root, 'source'))).rejects.toThrow('路径')
  await expect(readFile(join(root, 'outside.md'))).rejects.toMatchObject({ code: 'ENOENT' })
})
