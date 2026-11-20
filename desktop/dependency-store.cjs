const fs = require('node:fs/promises')
const path = require('node:path')
const { randomUUID, createHash } = require('node:crypto')

const storeVersion = 'v10' // pnpm 10.33.0
const manifestName = 'store-seed.json'
const contentFile = /^files\/[a-f0-9]{2}\/[a-f0-9]+(?:-exec)?$/
const indexFile = /^index\/[a-f0-9]{2}\/[a-f0-9]+-[^<>:"/\\|?*\x00-\x1f]+\.json$/
const tarballIntegrity = /^file\+vendor\+slidev-addon-studio-\d+\.\d+\.\d+\.tgz\/tarball-integrity$/

async function collectFiles(root, directory, pattern) {
  const files = []
  for (const bucket of await fs.readdir(path.join(root, directory), { withFileTypes: true })) {
    if (!bucket.isDirectory() || !/^[a-f0-9]{2}$/.test(bucket.name)) continue
    const prefix = `${directory}/${bucket.name}`
    for (const entry of await fs.readdir(path.join(root, prefix), { withFileTypes: true })) {
      const relative = `${prefix}/${entry.name}`
      if (entry.isFile() && pattern.test(relative)) files.push(relative)
    }
  }
  if (!files.length) throw new Error(`随附 store 缺少 ${directory} 文件。`)
  return files.sort()
}

async function nativePackageFiles(root, indexes, files) {
  const content = new Set(files)
  const required = new Set()
  for (const index of indexes) {
    const pkg = JSON.parse(await fs.readFile(path.join(root, index), 'utf8'))
    const entries = Object.entries(pkg.files ?? {})
    if (!entries.some(([file]) => file.endsWith('.node'))) continue
    required.add(index)
    for (const [file, { integrity, mode }] of entries) {
      const encoded = integrity?.match(/^sha(?:1|256|384|512)-([A-Za-z0-9+/]+={0,2})$/)?.[1]
      if (!encoded) throw new Error(`原生依赖索引缺少有效校验值：${index} (${file})`)
      const hex = Buffer.from(encoded, 'base64').toString('hex')
      const relative = `files/${hex.slice(0, 2)}/${hex.slice(2)}${mode & 0o111 ? '-exec' : ''}`
      if (!content.has(relative)) throw new Error(`随附 store 缺少原生依赖文件：${index} (${file})`)
      required.add(relative)
    }
  }
  return [...required].sort()
}

async function writeStoreSeed(storeDir, { platform, arch }) {
  const bundle = path.dirname(storeDir)
  const root = path.join(storeDir, storeVersion)
  const files = await collectFiles(root, 'files', contentFile)
  const indexes = await collectFiles(root, 'index', indexFile)
  const tarballs = []
  for (const directory of await fs.readdir(root, { withFileTypes: true })) {
    const relative = `${directory.name}/tarball-integrity`
    if (directory.isDirectory() && tarballIntegrity.test(relative) && (await fs.lstat(path.join(root, relative))).isFile())
      tarballs.push(relative)
  }
  tarballs.sort()
  const lock = await fs.readFile(path.join(bundle, 'pnpm-lock.yaml'))
  const nativeFiles = await nativePackageFiles(root, indexes, files)
  const baseline = createHash('sha256').update(JSON.stringify({ platform, arch, storeVersion, files, indexes, tarballs, nativeFiles })).update(lock).digest('hex')
  await fs.writeFile(path.join(bundle, manifestName), JSON.stringify({ storeVersion, baseline, files, indexes, tarballs, nativeFiles }))
}

async function lstat(file) {
  try { return await fs.lstat(file) }
  catch (error) {
    if (error.code !== 'ENOENT') throw error
  }
}

async function locateDirectory(directory) {
  try {
    const location = await fs.realpath(directory)
    return { location, volume: (await fs.stat(location, { bigint: true })).dev }
  }
  catch (error) {
    const parent = path.dirname(directory)
    if (error.code !== 'ENOENT' || parent === directory || await lstat(directory)) throw error
    const ancestor = await locateDirectory(parent)
    return { location: path.join(ancestor.location, path.basename(directory)), volume: ancestor.volume }
  }
}

function contains(parent, child) {
  const relative = path.relative(parent, child)
  return !relative || (relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative))
}

async function publishFile(source, destination, temporaryFile) {
  let existing = await lstat(destination)
  if (!existing) {
    if (!(await fs.lstat(source)).isFile()) throw new Error(`随附 store 文件无效：${source}`)
    await fs.copyFile(source, temporaryFile)
    try {
      // Publish a complete file without replacing an index pnpm has built or updated.
      await fs.link(temporaryFile, destination)
      return true
    }
    catch (error) {
      if (error.code !== 'EEXIST') throw error
      existing = await fs.lstat(destination)
    }
    finally { await fs.unlink(temporaryFile) }
  }
  if (!existing.isFile()) throw new Error(`目标 store 路径不是普通文件：${destination}`)
  return false
}

async function seedStore(source, destination, project, manifest, signal) {
  signal?.throwIfAborted()
  if (manifest?.storeVersion !== storeVersion || typeof manifest.baseline !== 'string' || !/^[a-f0-9]{64}$/.test(manifest.baseline) || !Array.isArray(manifest.nativeFiles))
    throw new Error('随附 store 文件清单的格式无效。')
  const marker = path.join(destination, `.slidev-studio-seed-${manifest.baseline}`)
  const temporary = await fs.mkdtemp(path.join(destination, '.slidev-studio-seed-'))
  try {
    const temporaryFile = path.join(temporary, 'file')
    const probe = path.join(project, `.slidev-studio-link-${randomUUID()}`)
    await fs.writeFile(temporaryFile, '')
    try { await fs.link(temporaryFile, probe) }
    catch (error) { throw new Error(`目标 store 无法与工程共享硬链接（${error.message}）。`, { cause: error }) }
    await fs.unlink(probe)
    await fs.unlink(temporaryFile)

    const receipt = await lstat(marker)
    if (receipt) {
      if (!receipt.isFile() || receipt.size !== 0) throw new Error(`目标 store 的完成标记无效：${marker}`)
      // pnpm can silently skip a missing optional native binding during offline install.
      let missing = false
      for (const file of manifest.nativeFiles) {
        signal?.throwIfAborted()
        if (typeof file !== 'string' || (!contentFile.test(file) && !indexFile.test(file)))
          throw new Error('随附 store 的原生依赖清单包含无效路径。')
        if (!(await lstat(path.join(destination, file)))?.isFile()) {
          missing = true
          break
        }
      }
      if (!missing) return { marker, reused: true }
    }

    const groups = [[manifest.files, contentFile], [manifest.indexes, indexFile], [manifest.tarballs, tarballIntegrity]]
    for (const [entries, pattern] of groups) {
      if (!Array.isArray(entries) || (pattern !== tarballIntegrity && !entries.length) || entries.some(file => typeof file !== 'string' || !pattern.test(file)))
        throw new Error('随附 store 文件清单包含无效路径。')
    }
    const directories = new Set()
    let copied = 0
    for (const [entries] of groups) {
      for (const file of entries) {
        signal?.throwIfAborted()
        const parent = path.dirname(file)
        for (const relative of [file.split('/')[0], parent]) {
          if (directories.has(relative)) continue
          const directory = path.join(destination, relative)
          await fs.mkdir(directory).catch(error => { if (error.code !== 'EEXIST') throw error })
          if (!(await fs.lstat(directory)).isDirectory()) throw new Error(`目标 store 路径不是普通目录：${directory}`)
          directories.add(relative)
        }
        if (await publishFile(path.join(source, file), path.join(destination, file), temporaryFile)) copied++
      }
    }
    signal?.throwIfAborted()
    // An empty file created exclusively is a complete receipt; concurrent initializers may both finish.
    try { await fs.writeFile(marker, '', { flag: 'wx' }) }
    catch (error) {
      if (error.code !== 'EEXIST') throw error
      const receipt = await fs.lstat(marker)
      if (!receipt.isFile() || receipt.size !== 0) throw error
    }
    return { marker, copied }
  }
  finally { await fs.rm(temporary, { recursive: true, force: true }) }
}

async function selectDependencyStore({ projectRoot, storeDir, queryStore, onPrepare, signal }) {
  let candidate
  try {
    const project = await fs.realpath(projectRoot)
    const volume = (await fs.stat(project, { bigint: true })).dev
    const source = await locateDirectory(path.join(storeDir, storeVersion))
    if (source.volume === volume)
      return { storeDir, detail: '随附 store 与工程同卷。' }

    const manifest = JSON.parse(await fs.readFile(path.join(path.dirname(storeDir), manifestName), 'utf8'))
    signal?.throwIfAborted()
    candidate = await queryStore()
    signal?.throwIfAborted()
    if (typeof candidate !== 'string' || !path.isAbsolute(candidate) || path.basename(candidate) !== storeVersion)
      throw new Error(`pnpm 返回了无法使用的 ${storeVersion} store 路径。`)
    const { location: destination, volume: destinationVolume } = await locateDirectory(candidate)
    if (contains(projectRoot, candidate) || contains(project, destination) || contains(destination, project))
      throw new Error('目标 store 与工程目录重叠。')
    if (destinationVolume !== volume)
      throw new Error('目标 store 与工程不在同一卷。')
    await fs.mkdir(destination, { recursive: true })
    const prepared = await locateDirectory(candidate)
    if (path.relative(prepared.location, destination) || prepared.volume !== volume)
      throw new Error('准备期间目标 store 的实际位置发生变化。')

    onPrepare(destination)
    const result = await seedStore(source.location, destination, project, manifest, signal)
    return {
      storeDir: candidate, marker: result.marker,
      detail: result.reused ? '复用目标卷中已准备的随附依赖。' : `已向目标卷补齐 ${result.copied} 个随附依赖文件。`,
    }
  }
  catch (error) {
    signal?.throwIfAborted()
    if (['ENOSPC', 'EDQUOT', 'EFBIG', 'EIO'].includes(error.code ?? error.cause?.code))
      throw new Error(`准备目标卷 store 失败：${candidate ?? storeDir}。${error.message}`, { cause: error })
    const reason = error.code === 'ENOENT' && error.path === path.join(path.dirname(storeDir), manifestName)
      ? '随附资源没有跨卷文件清单。'
      : error.message
    return { storeDir, detail: `目标卷缓存不可用，使用随附 store。${candidate ? `目标：${candidate}。` : ''}${reason}` }
  }
}

module.exports = { selectDependencyStore, writeStoreSeed }
