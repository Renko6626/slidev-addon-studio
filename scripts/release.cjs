const fs = require('node:fs')
const path = require('node:path')
const { createHash } = require('node:crypto')
const { spawnSync } = require('node:child_process')
const { readDesktopRelease } = require('../desktop/client-release.cjs')

const root = path.resolve(__dirname, '..')
const repository = 'Renko6626/slidev-addon-studio'
const readJson = file => JSON.parse(fs.readFileSync(file, 'utf8'))
const sha256 = file => createHash('sha256').update(fs.readFileSync(file)).digest('hex')

function validateVersion(version) {
  if (!/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(version ?? ''))
    throw new Error('版本号必须使用 X.Y.Z，例如 0.5.0；online/offline 写在文件名中。')
}

function setVersion(projectRoot, target, version) {
  if (!['studio', 'desktop'].includes(target)) throw new Error('请选择 studio 或 desktop 版本。')
  validateVersion(version)
  const file = path.join(projectRoot, target === 'studio' ? 'package.json' : 'desktop/package.json')
  fs.writeFileSync(file, JSON.stringify({ ...readJson(file), version }, null, 2) + '\n')
}

function releaseInfo(projectRoot, offline = false) {
  const studioVersion = readJson(path.join(projectRoot, 'package.json')).version
  const desktopVersion = readJson(path.join(projectRoot, 'desktop/package.json')).version
  validateVersion(studioVersion)
  validateVersion(desktopVersion)
  const mode = offline ? 'offline' : 'online'
  const directory = path.resolve(projectRoot, '../release/studio', desktopVersion)
  return {
    projectRoot, studioVersion, desktopVersion, mode, directory,
    sourceZip: path.join(projectRoot, 'desktop/out/make/zip/win32/x64', `Slidev Studio-win32-x64-${desktopVersion}.zip`),
    sourceAddon: path.join(projectRoot, 'desktop/studio-resources/slidev-addon-studio.tgz'),
    zip: path.join(directory, `Slidev-Studio-${desktopVersion}-win32-x64-${mode}.zip`),
    addon: path.join(directory, `slidev-addon-studio-${studioVersion}.tgz`),
    checksums: path.join(directory, `SHA256SUMS-${mode}.txt`),
  }
}

function collectArtifacts(info) {
  fs.mkdirSync(info.directory, { recursive: true })
  fs.copyFileSync(info.sourceZip, info.zip)
  fs.copyFileSync(info.sourceAddon, info.addon)
  fs.writeFileSync(info.checksums, [info.zip, info.addon].map(file => `${sha256(file)}  ${path.basename(file)}\n`).join(''))
}

function run(command, args, cwd = root, spawn = spawnSync) {
  const result = spawn(command, args, { cwd, stdio: 'inherit' })
  if (result.error) throw result.error
  if (result.status !== 0) throw new Error(`${path.basename(command)} 执行失败（退出码 ${result.status ?? result.signal}）。`)
}

function build(info, dryRun) {
  readDesktopRelease(info.projectRoot)
  const prepare = [path.join(root, 'desktop/scripts/prepare.cjs'), '--published', ...(info.mode === 'offline' ? ['--offline'] : [])]
  const forge = [path.join(root, 'desktop/node_modules/@electron-forge/cli/dist/electron-forge.js'), 'make', '--platform=win32', '--arch=x64']
  if (dryRun) {
    console.log(`模式：${info.mode}\n桌面版本：${info.desktopVersion}\n随附 Studio：${info.studioVersion}（构建时从 npm 取得精确版本）\n输出：${info.directory}`)
    console.log('node', ...prepare)
    console.log('node', ...forge)
    console.log(`归档：${path.basename(info.zip)}、${path.basename(info.addon)}、${path.basename(info.checksums)}`)
    return
  }
  run(process.execPath, prepare)
  run(process.execPath, forge, path.join(root, 'desktop'))
  collectArtifacts(info)
  console.log(`打包完成：${info.zip}\n校验表：${info.checksums}`)
}

function publish(info, dryRun, spawn = spawnSync) {
  readDesktopRelease(info.projectRoot)
  // Only upload artifacts that still match the local build's checksum sheet.
  const expected = [info.zip, info.addon].map(file => `${sha256(file)}  ${path.basename(file)}\n`).join('')
  if (fs.readFileSync(info.checksums, 'utf8') !== expected)
    throw new Error('产物与校验表不一致，请重新打包后再发布。')
  const tag = `desktop-v${info.desktopVersion}`
  const notes = path.join(info.projectRoot, 'docs/releases', `desktop-${info.desktopVersion}.md`)
  const createArgs = ['release', 'create', tag, info.zip, info.addon, info.checksums, '--repo', repository,
    '--verify-tag', '--title', `Desktop ${info.desktopVersion}`, '--notes-file', notes, '--prerelease', '--latest=false']
  if (dryRun) {
    console.log('只预览，不联网、不推送标签、不上传文件。')
    if (info.mode === 'online') console.log('不存在该 Release 时：gh', ...createArgs)
    else console.log('离线版仅追加到已经包含轻量版的 Release。')
    console.log('已有 Release 时：上传所选模式 ZIP 和校验表；addon 仅在缺失时上传。已有同名资产会报错，不覆盖。')
    console.log('先发布轻量版，离线版仅补充到同一 Release；新建 Release 默认预发布，实机确认后再手动提升稳定。')
    return
  }
  const existing = spawn('gh', ['release', 'view', tag, '--repo', repository, '--json', 'assets'], { encoding: 'utf8' })
  if (existing.error) throw existing.error
  if (existing.status !== 0) {
    if (info.mode === 'offline') throw new Error('请先发布轻量版，再为同一 Release 补充离线版。')
    run('gh', createArgs, root, spawn)
    return
  }
  const assets = JSON.parse(existing.stdout).assets
  if (info.mode === 'offline' && !assets.some(asset => asset.name === `Slidev-Studio-${info.desktopVersion}-win32-x64-online.zip`))
    throw new Error('该 Release 缺少轻量版，请先补充轻量版再上传离线版。')
  run('gh', ['release', 'upload', tag, info.zip, info.checksums,
    ...(!assets.some(asset => asset.name === path.basename(info.addon)) ? [info.addon] : []), '--repo', repository], root, spawn)
}

function main(args) {
  if (!args.length || args.includes('--help')) {
    console.log('用法：\n  pnpm release:version studio X.Y.Z\n  pnpm release:version desktop X.Y.Z\n  pnpm release:build [--offline] [--dry-run]\n  pnpm release:publish [--offline] [--prerelease] [--dry-run]\n\n默认轻量版；正式构建使用已发布的 Studio。新建 Release 默认预发布，可用 --prerelease 显式标明。publish 仅手动上传 GitHub，不构建、不推标签、不发布 npm。')
    return
  }
  const [command, ...flags] = args
  if (command === 'version') {
    if (flags.length !== 2) throw new Error('用法：pnpm release:version studio|desktop X.Y.Z')
    setVersion(root, flags[0], flags[1])
    console.log(`${flags[0]} 版本已设为 ${flags[1]}，未修改另一个包，未提交或创建标签。`)
    return
  }
  if (!['build', 'publish'].includes(command) || flags.some(flag => !['--offline', '--dry-run', ...(command === 'publish' ? ['--prerelease'] : [])].includes(flag)))
    throw new Error('未知命令或参数。运行 node scripts/release.cjs --help 查看用法。')
  const info = releaseInfo(root, flags.includes('--offline'))
  if (command === 'build') build(info, flags.includes('--dry-run'))
  else publish(info, flags.includes('--dry-run'))
}

module.exports = { releaseInfo, setVersion, collectArtifacts, publish }
if (require.main === module) {
  try { main(process.argv.slice(2)) }
  catch (error) { console.error(error.message); process.exitCode = 1 }
}
