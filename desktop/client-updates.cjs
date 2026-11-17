const { RELEASES_URL, readBundledDesktopRelease, checkDesktopRelease } = require('./client-release.cjs')
const { compareStudioVersions } = require('./studio-packages.cjs')

function createClientUpdates({ resources, currentVersion, dialog, shell, getWindow, check = checkDesktopRelease }) {
  const owner = () => { const window = getWindow(); return window && !window.isDestroyed() ? window : null }

  async function checkUpdate() {
    const latest = await check()
    const window = owner()
    if (!window) return { ok: false }
    const newer = latest && compareStudioVersions(latest.version, currentVersion) > 0
    const detail = [`当前客户端：${currentVersion}`,
      ...(latest ? [`最新稳定客户端：${latest.version}`, '', latest.notes.slice(0, 2000)] : ['暂未找到可下载的稳定客户端。']),
      '', '请完整解压新版到新的可写目录，再打开原工程。客户端查新不会修改工程内的 Studio。',
    ].join('\n')
    const result = await dialog.showMessageBox(window, {
      type: 'info', message: newer ? `发现客户端 ${latest.version}` : latest ? '没有更高的稳定客户端可更新。' : '客户端发布信息',
      detail, buttons: ['关闭', '查看更新与下载'], defaultId: 0, cancelId: 0,
    })
    if (result.response === 1 && owner()) {
      await shell.openExternal(latest ? `${RELEASES_URL}/tag/desktop-v${latest.version}` : RELEASES_URL)
    }
    return { ok: true }
  }

  return async function clientUpdates(action) {
    if (!owner()) return { ok: false }
    try {
      if (action === 'check') return await checkUpdate()
      const info = readBundledDesktopRelease(resources)
      if (info.desktopVersion !== currentVersion) throw new Error('客户端版本信息不匹配，请重新准备或取得完整客户端。')
      const result = await dialog.showMessageBox(owner(), {
        type: 'info', message: `Slidev Studio 客户端 ${currentVersion}`,
        detail: `随附 Studio 编辑器：${info.studioVersion}\n已有工程保留自己的编辑器版本。\n\n${info.notes}`,
        buttons: ['关闭', '检查客户端更新', '打开发布页'], defaultId: 0, cancelId: 0,
      })
      if (!owner()) return { ok: false }
      if (result.response === 1) return await checkUpdate()
      if (result.response === 2) await shell.openExternal(RELEASES_URL)
      return { ok: true }
    }
    catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      const window = owner()
      if (window) {
        const result = await dialog.showMessageBox(window, {
          type: 'error', message: '客户端版本与更新暂不可用',
          detail: `${message}\n\n可继续编辑，稍后手动重试，或打开发布页查看下载。`,
          buttons: ['关闭', '打开发布页'], defaultId: 0, cancelId: 0,
        })
        if (result.response === 1 && owner()) await shell.openExternal(RELEASES_URL)
      }
      return { ok: false, error: message }
    }
  }
}

module.exports = { createClientUpdates }
