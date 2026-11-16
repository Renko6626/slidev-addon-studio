const fs = require('node:fs/promises')

/** Native commands stay available even when the project's renderer cannot load. */
function createProjectManagement({ getProject, getLogPath, getWindow, isWorking, recover, dialog, shell, clipboard }) {
  return async function manage(action) {
    const window = getWindow()
    const project = getProject()
    const logPath = getLogPath()
    try {
      if (action === 'folder') {
        if (!project) throw new Error('尚未打开工程。')
        const error = await shell.openPath(project.root)
        if (error) throw new Error(error)
      }
      else if (action === 'logs') {
        if (!logPath) throw new Error('尚无运行日志。')
        const error = await shell.openPath(logPath)
        if (error) throw new Error(error)
      }
      else if (action === 'diagnostics') {
        const log = logPath ? await fs.readFile(logPath, 'utf8') : '尚无运行日志。'
        clipboard.writeText([
          'Slidev Studio 工程诊断',
          `工程目录：${project?.root ?? '尚未打开工程'}`,
          `入口文件：${project?.entry ?? '未知'}`,
          `运行日志：${logPath || '尚无'}`,
          '请在工程目录打开 coding agent，先读 AGENTS.md 和 node_modules/slidev-addon-studio/skills/studio-authoring/SKILL.md。',
          '保留用户已有排版和字段，结合日志及当前代码修复；不要自动回滚整个工程。',
          '', '最近日志：', log.slice(-16000),
        ].join('\n'))
      }
      else if (action === 'reload' || action === 'home') {
        if (isWorking()) throw new Error('正在准备工程，请等待当前操作结束；可以先查看日志。')
        if (action === 'reload' && !project) throw new Error('尚未打开工程。')
        const result = await dialog.showMessageBox(window, {
          type: 'warning', message: action === 'reload' ? '从磁盘重新加载工程？' : '停止当前工程并返回主页？',
          detail: '已写入磁盘的源码会保留。尚未应用的文字、备注或未保存修改可能丢失。此操作不会调用页面的保存接口。',
          buttons: ['取消', action === 'reload' ? '重新加载' : '返回主页'], defaultId: 0, cancelId: 0,
        })
        if (result.response !== 1) return false
        await recover(action, project)
      }
      else return false
      return true
    }
    catch (error) {
      await dialog.showMessageBox(window, { type: 'error', message: '工程管理操作未完成', detail: error instanceof Error ? error.message : String(error), buttons: ['知道了'] })
      return false
    }
  }
}

module.exports = { createProjectManagement }
