const path = require('node:path')
const { compareStudioVersions } = require('./studio-packages.cjs')
const { readProjectStudio, enableStudio } = require('./projects.cjs')

/** One explicitly requested update; the host owns dialogs, saving and processes. */
async function runStudioUpdate({ packages, resources, project, save, stop, open, confirm, status = () => {} }) {
  status({ message: '正在检查 Studio 更新。' })
  const local = await packages.local()
  const latest = await packages.check()
  if (latest.version === local.version && latest.integrity !== local.integrity)
    throw new Error(`Studio ${local.version} 的本地包与发布包内容不一致，请使用不同版本号发布修改。`)
  const target = compareStudioVersions(latest.version, local.version) > 0 ? latest : local
  const installed = project ? await readProjectStudio(project) : null
  const currentVersion = installed ? installed.installedVersion ?? installed.expectedVersion : null
  if (project && !currentVersion) throw new Error('无法读取当前工程的 Studio 版本，请先完成工程依赖安装。')
  const canUpdate = compareStudioVersions(target.version, currentVersion ?? local.version) > 0
  const accepted = await confirm({ projectName: project ? path.basename(project.root) : null, currentVersion, localVersion: local.version, latestVersion: latest.version, targetVersion: target.version, canUpdate })
  if (!canUpdate || !accepted) {
    status({ message: canUpdate ? '已取消 Studio 更新。' : '检查完成，保留当前 Studio 版本。' })
    return { ok: true }
  }
  status({ message: `正在取得 Studio ${target.version}。` })
  const archive = target.archive ? target : await packages.acquire(target)
  if (!project) {
    status({ message: `Studio ${archive.version} 已下载，新建工程将使用这个版本。` })
    return { ok: true }
  }
  if (!await save()) { status({ message: '保存未完成，已停止 Studio 更新。' }); return { ok: false } }
  await stop()
  status({ message: `正在更新当前工程到 Studio ${archive.version}。` })
  await enableStudio(project, resources, archive)
  if (!await open(project)) throw new Error('Studio 更新后未能重新打开工程，请查看运行日志。')
  status({ message: `当前工程已更新到 Studio ${archive.version}。` })
  return { ok: true }
}

module.exports = { runStudioUpdate }
