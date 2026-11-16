const fs = require('node:fs/promises')
const path = require('node:path')
const JSZip = require('jszip')
const { STUDIO_PACKAGE, packageIntegrity, readBundledStudio, compareStudioVersions } = require('./studio-packages.cjs')

const ADDON = 'slidev-addon-studio'
const archivePath = version => `vendor/slidev-addon-studio-${version}.tgz`
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
  const source = deps[ADDON]
  if (typeof source !== 'string' || !/^file:vendor\/slidev-addon-studio(?:-\d+\.\d+\.\d+)?\.tgz$/.test(source) || !project.manifest.slidev?.addons?.includes(ADDON)) return false
  const target = path.join(project.root, source.slice(5))
  if (!await exists(target)) return false
  return packageIntegrity(await fs.readFile(target)) === (await readBundledStudio(resources)).integrity
}

async function readProjectStudio(project) {
  const deps = { ...project.manifest.devDependencies, ...project.manifest.dependencies }
  const source = deps[ADDON]
  const configured = typeof source === 'string' && !!project.manifest.slidev?.addons?.includes(ADDON)
  const managed = configured && /^file:vendor\/slidev-addon-studio(?:-\d+\.\d+\.\d+)?\.tgz$/.test(source)
  let installedVersion = null
  const installed = path.join(project.root, 'node_modules/slidev-addon-studio/package.json')
  if (await exists(installed)) installedVersion = JSON.parse(await fs.readFile(installed, 'utf8')).version ?? null
  const expectedVersion = managed ? source.match(/-(\d+\.\d+\.\d+)\.tgz$/)?.[1] ?? null : null
  return { installedVersion, expectedVersion, configured, managed }
}

async function enableStudio(project, resources, studioPackage) {
  studioPackage ??= await readBundledStudio(resources)
  if (studioPackage.name !== STUDIO_PACKAGE) throw new Error('Studio 包名称不匹配。')
  compareStudioVersions(studioPackage.version, studioPackage.version)
  const bytes = await fs.readFile(studioPackage.archive)
  if (packageIntegrity(bytes) !== studioPackage.integrity) throw new Error('Studio 本地包校验失败。')
  const archive = archivePath(studioPackage.version)
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
  group[ADDON] = `file:${archive}`
  manifest.slidev ??= {}
  if (typeof manifest.slidev !== 'object' || Array.isArray(manifest.slidev))
    throw new Error('package.json 的 slidev 配置需要是一个对象，请先修正后重新打开。')
  const addons = manifest.slidev.addons ?? []
  if (!Array.isArray(addons)) throw new Error('package.json 中的 slidev.addons 需要是数组。')
  manifest.slidev.addons = [...new Set([...addons, ADDON])]
  await fs.mkdir(path.join(project.root, 'vendor'), { recursive: true })
  await fs.writeFile(path.join(project.root, archive), bytes)
  await fs.writeFile(path.join(project.root, 'package.json'), `${JSON.stringify(manifest, null, 2)}\n`)
  project.manifest = manifest
}

async function createProject(directory, resources, target = {}) {
  directory = path.resolve(directory)
  await emptyDirectory(directory)
  await fs.cp(path.join(resources, 'template'), directory, { recursive: true })
  const studioPackage = target.studioPackage ?? await readBundledStudio(resources)
  const manifest = standardManifest(studioPackage.version)
  const project = { root: directory, entry: path.join(directory, 'slides.md'), manifest }
  await enableStudio(project, resources, studioPackage)
  const bundle = offlineDirectory(resources, target)
  if (bundle && await exists(path.join(bundle, 'pnpm-lock.yaml')) && await hasBundledStudio(project, resources)) {
    for (const name of ['pnpm-lock.yaml', 'pnpm-workspace.yaml'])
      await fs.copyFile(path.join(bundle, name), path.join(directory, name))
  }
  return project
}

function standardManifest(version) {
  return {
    name: 'studio-presentation', private: true, type: 'module', packageManager: 'pnpm@10.33.0',
    scripts: { dev: 'slidev slides.md', build: 'slidev build slides.md' },
    devDependencies: { ...BASE_DEPENDENCIES, pinia: '3.0.4', [ADDON]: `file:${archivePath(version)}` },
    slidev: { addons: [ADDON] },
  }
}

function offlineDirectory(resources, { platform = process.platform, arch = process.arch } = {}) {
  return platform === 'win32' && arch === 'x64' ? path.join(resources, 'offline', 'win32-x64') : null
}

async function sameFile(left, right) {
  if (!await exists(left) || !await exists(right)) return false
  return (await fs.readFile(left)).equals(await fs.readFile(right))
}

/** Recognize only the shipped baseline; custom projects retain their own environment. */
async function dependencyPreparation(project, resources, target = {}) {
  const studio = await readProjectStudio(project)
  const cli = path.join(project.root, 'node_modules/@slidev/cli/bin/slidev.mjs')
  const candidate = offlineDirectory(resources, target)
  const bundle = candidate && await exists(path.join(candidate, 'store')) && await exists(path.join(candidate, 'package.json')) ? candidate : null
  const store = bundle ? { storeDir: path.join(bundle, 'store') } : {}
  const ordinary = { needsInstall: true, ...store, offline: false }
  const runtimePresent = await exists(cli) && (!studio.configured || studio.installedVersion && await exists(path.join(project.root, 'node_modules/slidev-addon-studio/runtime/index.ts')))
  if (!studio.managed) return { ...ordinary, needsInstall: !runtimePresent }
  const deps = { ...project.manifest.devDependencies, ...project.manifest.dependencies }
  if (!await exists(path.join(project.root, deps[ADDON].slice(5)))) return ordinary
  const expectedVersion = studio.expectedVersion ?? studio.installedVersion ?? (await readBundledStudio(resources)).version
  const baseline = standardManifest(expectedVersion)
  baseline.devDependencies[ADDON] = deps[ADDON]
  const ordered = value => Object.entries(value ?? {}).sort(([a], [b]) => a.localeCompare(b))
  for (const field of ['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies', 'pnpm', 'scripts'])
    if (JSON.stringify(ordered(project.manifest[field])) !== JSON.stringify(ordered(baseline[field]))) return ordinary
  if (project.manifest.packageManager !== baseline.packageManager) return ordinary
  for (const name of ['.pnpmfile.cjs', '.pnpmfile.mjs'])
    if (await exists(path.join(project.root, name))) return ordinary
  let offline = false
  if (bundle && await hasBundledStudio(project, resources)) {
    const bundledManifest = JSON.parse(await fs.readFile(path.join(bundle, 'package.json'), 'utf8'))
    offline = JSON.stringify(ordered(project.manifest.devDependencies)) === JSON.stringify(ordered(bundledManifest.devDependencies))
      && await sameFile(path.join(project.root, 'pnpm-lock.yaml'), path.join(bundle, 'pnpm-lock.yaml'))
      && await sameFile(path.join(project.root, 'pnpm-workspace.yaml'), path.join(bundle, 'pnpm-workspace.yaml'))
  }
  const prepared = runtimePresent
    && studio.installedVersion === expectedVersion
    && await sameFile(path.join(project.root, 'pnpm-lock.yaml'), path.join(project.root, 'node_modules/.pnpm/lock.yaml'))
  return { needsInstall: !prepared, ...store, offline }
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

module.exports = { exists, inspectProject, createProject, enableStudio, hasBundledStudio, readProjectStudio, saveProjectCopy, standardManifest, dependencyPreparation }
