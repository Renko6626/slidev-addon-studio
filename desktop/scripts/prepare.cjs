const fs = require('node:fs/promises')
const path = require('node:path')
const { execFileSync } = require('node:child_process')
const { prepareOffline } = require('./prepare-offline.cjs')

async function prepare() {
  const desktop = path.resolve(__dirname, '..')
  const root = path.dirname(desktop)
  const resources = path.join(desktop, 'studio-resources')
  const pnpm = path.join(desktop, 'node_modules/pnpm/bin/pnpm.cjs')
  await fs.mkdir(resources, { recursive: true })
  for (const name of await fs.readdir(resources)) if (name.endsWith('.tgz')) await fs.rm(path.join(resources, name))
  execFileSync(process.execPath, [pnpm, '--config.manage-package-manager-versions=false', 'pack', '--pack-destination', resources], { cwd: root, stdio: ['ignore', 'pipe', 'inherit'] })
  const archives = (await fs.readdir(resources)).filter(name => name.endsWith('.tgz'))
  if (archives.length !== 1) throw new Error('未能唯一确定当前 Studio addon 包。')
  await fs.rename(path.join(resources, archives[0]), path.join(resources, 'slidev-addon-studio.tgz'))
  await fs.rm(path.join(resources, 'template'), { recursive: true, force: true })
  await fs.cp(path.join(desktop, 'template'), path.join(resources, 'template'), { recursive: true })
  console.log('已准备当前源码的 Studio addon 和标准工程模板。')
  if (process.argv.includes('--offline')) await prepareOffline({ resources, pnpm })
  else await fs.rm(path.join(resources, 'offline'), { recursive: true, force: true })
}

prepare().catch(error => { console.error(error.message); process.exitCode = 1 })
