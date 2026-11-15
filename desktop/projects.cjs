const fs = require('node:fs/promises')
const path = require('node:path')
const crypto = require('node:crypto')
const JSZip = require('jszip')

const ADDON = 'slidev-addon-studio'
const ARCHIVE = 'vendor/slidev-addon-studio.tgz'
const BASE_DEPENDENCIES = {
  '@slidev/cli': '52.19.0', '@slidev/theme-default': '0.25.0', vue: '3.5.41',
  // The CLI's Markdown plugins currently import markdown-it 14 internals.
  // An unconstrained auto-installed peer can select 15 and fail at startup.
  'markdown-it': '14.3.0',
}

async function exists(file) {
  try { await fs.access(file); return true }
  catch (error) { if (error.code === 'ENOENT') return false; throw error }
}

async function inspectProject(entry) {
  entry = await fs.realpath(entry)
  if (path.extname(entry).toLowerCase() !== '.md' || !(await fs.stat(entry)).isFile())
    throw new Error('请选择 Slidev 工程的 Markdown 入口文件。')
  let root = path.dirname(entry)
  while (true) {
    if (await exists(path.join(root, 'package.json')))
      return { root, entry, manifest: JSON.parse(await fs.readFile(path.join(root, 'package.json'), 'utf8')) }
    if (root === path.dirname(root)) return { root: path.dirname(entry), entry, manifest: {} }
    root = path.dirname(root)
  }
}

async function emptyDirectory(directory) {
  if (await exists(directory)) {
    if (!(await fs.stat(directory)).isDirectory() || (await fs.readdir(directory)).length)
      throw new Error('所选位置非空，请选择一个新的空文件夹。')
  }
  else await fs.mkdir(directory, { recursive: true })
}

async function hasBundledStudio(project, resources) {
  const deps = { ...project.manifest.devDependencies, ...project.manifest.dependencies }
  if (deps[ADDON] !== `file:${ARCHIVE}` || !project.manifest.slidev?.addons?.includes(ADDON)) return false
  const target = path.join(project.root, ARCHIVE)
  if (!await exists(target)) return false
  const hash = data => crypto.createHash('sha256').update(data).digest('hex')
  return hash(await fs.readFile(target)) === hash(await fs.readFile(path.join(resources, 'slidev-addon-studio.tgz')))
}

async function enableStudio(project, resources) {
  const manifest = structuredClone(project.manifest)
  manifest.devDependencies ??= {}
  const deps = { ...manifest.devDependencies, ...manifest.dependencies }
  // A plain Markdown deck needs a standard runtime; existing project versions
  // remain untouched, including projects that put the CLI in dependencies.
  if (!deps['@slidev/cli']) {
    for (const [name, version] of Object.entries(BASE_DEPENDENCIES))
      if (!deps[name]) manifest.devDependencies[name] = version
  }
  const group = manifest.dependencies?.[ADDON] ? manifest.dependencies : manifest.devDependencies
  group[ADDON] = `file:${ARCHIVE}`
  manifest.slidev ??= {}
  if (typeof manifest.slidev !== 'object' || Array.isArray(manifest.slidev))
    throw new Error('package.json 的 slidev 配置需要是一个对象，请先修正后重新打开。')
  const addons = manifest.slidev.addons ?? []
  if (!Array.isArray(addons)) throw new Error('package.json 中的 slidev.addons 需要是数组。')
  manifest.slidev.addons = [...new Set([...addons, ADDON])]
  await fs.mkdir(path.join(project.root, 'vendor'), { recursive: true })
  await fs.copyFile(path.join(resources, 'slidev-addon-studio.tgz'), path.join(project.root, ARCHIVE))
  await fs.writeFile(path.join(project.root, 'package.json'), `${JSON.stringify(manifest, null, 2)}\n`)
  project.manifest = manifest
}

async function createProject(directory, resources) {
  directory = path.resolve(directory)
  await emptyDirectory(directory)
  await fs.cp(path.join(resources, 'template'), directory, { recursive: true })
  const manifest = {
    name: 'studio-presentation', private: true, type: 'module', packageManager: 'pnpm@10.33.0',
    scripts: { dev: 'slidev slides.md', build: 'slidev build slides.md' },
    devDependencies: { ...BASE_DEPENDENCIES },
  }
  const project = { root: directory, entry: path.join(directory, 'slides.md'), manifest }
  await enableStudio(project, resources)
  return project
}

async function saveProjectCopy(data, destination, sourceRoot) {
  destination = path.resolve(destination)
  const fromSource = path.relative(path.resolve(sourceRoot), destination)
  if (fromSource === '' || (!fromSource.startsWith(`..${path.sep}`) && fromSource !== '..' && !path.isAbsolute(fromSource)))
    throw new Error('请另存到当前工程外的文件夹，不能放在工程内部。')
  const zip = await JSZip.loadAsync(data)
  const files = Object.values(zip.files)
  // Validate all entries before making or writing the destination.
  for (const file of files) {
    const original = file.unsafeOriginalName || file.name
    const segments = original.replaceAll('\\', '/').split('/')
    if (path.isAbsolute(original) || /^[a-z]:/i.test(original) || segments.includes('..'))
      throw new Error(`工程 ZIP 包含无效路径：${original}`)
  }
  await emptyDirectory(destination)
  for (const file of files) {
    const target = path.join(destination, file.name)
    if (file.dir) await fs.mkdir(target, { recursive: true })
    else {
      await fs.mkdir(path.dirname(target), { recursive: true })
      await fs.writeFile(target, await file.async('nodebuffer'))
    }
  }
}

module.exports = { exists, inspectProject, createProject, enableStudio, hasBundledStudio, saveProjectCopy }
