const fs = require('node:fs/promises')
const path = require('node:path')
const os = require('node:os')
const { execFileSync } = require('node:child_process')
const { prepareOffline } = require('./prepare-offline.cjs')
const { STUDIO_PACKAGE, packageIntegrity, compareStudioVersions, createStudioPackageSource } = require('../studio-packages.cjs')

async function writeStudioPackageInfo(resources, { name, version }) {
  if (name !== STUDIO_PACKAGE) throw new Error('Studio 包名称不匹配。')
  compareStudioVersions(version, version)
  const integrity = packageIntegrity(await fs.readFile(path.join(resources, 'slidev-addon-studio.tgz')))
  await fs.writeFile(path.join(resources, 'studio-package.json'), `${JSON.stringify({ name, version, integrity }, null, 2)}\n`)
}

async function prepare({ source = 'workspace', root = path.resolve(__dirname, '../..'), resources = path.join(root, 'desktop/studio-resources'), registryUrl, fetchImpl, offline = false } = {}) {
  const desktop = path.join(root, 'desktop')
  const pnpm = path.join(desktop, 'node_modules/pnpm/bin/pnpm.cjs')
  const manifest = JSON.parse(await fs.readFile(path.join(root, 'package.json'), 'utf8'))
  if (manifest.name !== STUDIO_PACKAGE) throw new Error('Studio 包名称不匹配。')
  compareStudioVersions(manifest.version, manifest.version)
  const temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'studio-prepare-'))
  try {
    let archive
    if (source === 'published') {
      const packages = createStudioPackageSource({ resources, userData: temporary, registryUrl, fetchImpl })
      archive = (await packages.acquire(await packages.check(manifest.version))).archive
    }
    else if (source === 'workspace') {
      execFileSync(process.execPath, [pnpm, '--config.manage-package-manager-versions=false', 'pack', '--pack-destination', temporary], { cwd: root, stdio: ['ignore', 'pipe', 'inherit'] })
      const archives = (await fs.readdir(temporary)).filter(name => name.endsWith('.tgz'))
      if (archives.length !== 1) throw new Error('未能唯一确定当前 Studio addon 包。')
      archive = path.join(temporary, archives[0])
    }
    else throw new Error('未知的 Studio 包来源。')
    await fs.mkdir(resources, { recursive: true })
    await fs.copyFile(archive, path.join(resources, 'slidev-addon-studio.tgz'))
    await writeStudioPackageInfo(resources, manifest)
    await fs.rm(path.join(resources, 'template'), { recursive: true, force: true })
    await fs.cp(path.join(desktop, 'template'), path.join(resources, 'template'), { recursive: true })
    console.log(`已准备 Studio ${manifest.version}（${source === 'published' ? 'npm 发布包' : '开发源码'}）和标准工程模板。`)
    if (offline) await prepareOffline({ resources, pnpm })
    else await fs.rm(path.join(resources, 'offline'), { recursive: true, force: true })
  }
  finally { await fs.rm(temporary, { recursive: true, force: true }) }
}

module.exports = { prepare, writeStudioPackageInfo }
if (require.main === module)
  prepare({ source: process.argv.includes('--published') ? 'published' : 'workspace', offline: process.argv.includes('--offline') }).catch(error => { console.error(error.message); process.exitCode = 1 })
