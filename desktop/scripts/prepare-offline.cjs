const fs = require('node:fs/promises')
const path = require('node:path')
const os = require('node:os')
const { spawn } = require('node:child_process')
const { createProject } = require('../projects.cjs')

/** Collect a fresh Windows-only pnpm store, never the developer's global store. */
async function prepareOffline({ resources, pnpm }) {
  const temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'studio-offline-build-'))
  const bundle = path.join(resources, 'offline', 'win32-x64')
  await fs.rm(bundle, { recursive: true, force: true })
  await fs.mkdir(bundle, { recursive: true })
  try {
    // No existing offline seed is copied while preparing the new bundle.
    const project = await createProject(path.join(temporary, 'project'), resources, { platform: 'build' })
    const workspace = 'packages:\n  - .\n'
    await fs.writeFile(path.join(project.root, 'pnpm-workspace.yaml'), `${workspace}supportedArchitectures:\n  os: [win32]\n  cpu: [x64]\n`)
    const run = args => new Promise((resolve, reject) => {
      const child = spawn(process.execPath, [pnpm, '--config.manage-package-manager-versions=false', '--config.package-manager-strict=false', ...args, '--store-dir', path.join(bundle, 'store'), '--ignore-scripts', '--reporter=append-only'], {
        cwd: project.root, stdio: 'inherit', env: { ...process.env, CI: 'true' },
      })
      child.once('error', reject)
      child.once('exit', code => code === 0 ? resolve() : reject(new Error(`Windows 离线依赖准备失败（退出码 ${code}）。`)))
    })
    await run(['install', '--lockfile-only', '--no-frozen-lockfile'])
    await run(['fetch'])
    await fs.copyFile(path.join(project.root, 'package.json'), path.join(bundle, 'package.json'))
    await fs.copyFile(path.join(project.root, 'pnpm-lock.yaml'), path.join(bundle, 'pnpm-lock.yaml'))
    // The target is selected at build time; the authored project stays portable.
    await fs.writeFile(path.join(bundle, 'pnpm-workspace.yaml'), workspace)
    console.log('已准备 Windows x64 离线依赖与固定锁文件。')
  }
  finally { await fs.rm(temporary, { recursive: true, force: true }) }
}

module.exports = { prepareOffline }
