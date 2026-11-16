const fs = require('node:fs/promises')
const path = require('node:path')
const { createHash } = require('node:crypto')

const STUDIO_PACKAGE = '@renko_1055/slidev-addon-studio'
const VERSION = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/
function versionParts(version) {
  if (typeof version !== 'string' || !VERSION.test(version)) throw new Error(`Studio 版本需要使用 X.Y.Z：${version ?? '未知'}`)
  return version.split('.').map(Number)
}
function compareStudioVersions(a, b) {
  const left = versionParts(a), right = versionParts(b)
  for (let i = 0; i < 3; i++) if (left[i] !== right[i]) return left[i] > right[i] ? 1 : -1
  return 0
}
function packageIntegrity(bytes) { return `sha512-${createHash('sha512').update(bytes).digest('base64')}` }
function validatePackage(info) {
  if (info.name !== STUDIO_PACKAGE) throw new Error('Studio 包名称不匹配。')
  versionParts(info.version)
  if (typeof info.integrity !== 'string' || !/^sha512-[A-Za-z0-9+/]+={0,2}$/.test(info.integrity))
    throw new Error('Studio 包缺少 SHA-512 校验信息。')
}
async function archiveInfo(archive, version) {
  return { name: STUDIO_PACKAGE, version, archive, integrity: packageIntegrity(await fs.readFile(archive)) }
}
async function readBundledStudio(resources) {
  const info = JSON.parse(await fs.readFile(path.join(resources, 'studio-package.json'), 'utf8'))
  validatePackage(info)
  const archive = await archiveInfo(path.join(resources, 'slidev-addon-studio.tgz'), info.version)
  if (archive.integrity !== info.integrity) throw new Error('随附 Studio 包校验失败，请重新取得完整的软件包。')
  return archive
}

/** Studio archives only; dependency storage and installation remain pnpm's job. */
function createStudioPackageSource({ resources, userData, registryUrl = 'https://registry.npmjs.org', fetchImpl = globalThis.fetch }) {
  const directory = path.join(userData, 'studio-packages')
  const filename = version => path.join(directory, `slidev-addon-studio-${version}.tgz`)
  async function local() {
    let selected = await readBundledStudio(resources)
    let files
    try { files = await fs.readdir(directory, { withFileTypes: true }) }
    catch (error) { if (error.code === 'ENOENT') return selected; throw error }
    for (const file of files) {
      const version = file.name.match(/^slidev-addon-studio-(\d+\.\d+\.\d+)\.tgz$/)?.[1]
      if (!file.isFile() || !version || !VERSION.test(version)) continue
      const candidate = await archiveInfo(path.join(directory, file.name), version)
      const order = compareStudioVersions(version, selected.version)
      if (order === 0 && candidate.integrity !== selected.integrity) throw new Error(`Studio ${version} 的本地包内容不一致，请检查本地归档。`)
      if (order > 0) selected = candidate
    }
    return selected
  }
  async function check(version = 'latest') {
    if (version !== 'latest') versionParts(version)
    const response = await fetchImpl(`${registryUrl.replace(/\/$/, '')}/${encodeURIComponent(STUDIO_PACKAGE)}/${version}`, { signal: AbortSignal.timeout(15000) })
    if (!response.ok) throw new Error(`未能查询 Studio ${version}（HTTP ${response.status}）。`)
    const metadata = await response.json()
    const info = { name: metadata.name, version: metadata.version, tarball: metadata.dist?.tarball, integrity: metadata.dist?.integrity }
    validatePackage(info)
    if (version !== 'latest' && info.version !== version) throw new Error('注册库返回的 Studio 版本不匹配。')
    const url = new URL(info.tarball)
    if (url.protocol !== 'https:' && !(new URL(registryUrl).protocol === 'http:' && url.protocol === 'http:'))
      throw new Error('Studio 下载地址需要使用 HTTPS。')
    return info
  }
  async function acquire(release) {
    validatePackage(release)
    const archive = filename(release.version)
    try {
      const cached = await archiveInfo(archive, release.version)
      if (cached.integrity !== release.integrity) throw new Error(`Studio ${release.version} 的本地归档与发布包不一致，请检查本地归档。`)
      return cached
    }
    catch (error) { if (error.code !== 'ENOENT') throw error }
    const response = await fetchImpl(release.tarball, { signal: AbortSignal.timeout(60000) })
    if (!response.ok) throw new Error(`Studio 下载失败（HTTP ${response.status}）。`)
    const bytes = Buffer.from(await response.arrayBuffer())
    if (packageIntegrity(bytes) !== release.integrity) throw new Error('Studio 下载包校验失败，请重新检查更新。')
    await fs.mkdir(directory, { recursive: true })
    const temporary = `${archive}.partial`
    try {
      await fs.writeFile(temporary, bytes)
      await fs.rename(temporary, archive)
    }
    finally { await fs.rm(temporary, { force: true }) }
    return { name: release.name, version: release.version, archive, integrity: release.integrity }
  }
  return { local, check, acquire }
}

module.exports = { STUDIO_PACKAGE, compareStudioVersions, packageIntegrity, readBundledStudio, createStudioPackageSource }
