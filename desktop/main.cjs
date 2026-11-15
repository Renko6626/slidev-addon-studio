const { app, BrowserWindow, Menu, dialog, ipcMain, shell } = require('electron')
const path = require('node:path')
const { pathToFileURL } = require('node:url')
const { exists, inspectProject, createProject, enableStudio, hasBundledStudio, saveProjectCopy } = require('./projects.cjs')
const { createRuntime } = require('./runtime.cjs')

let window
let current = null
let working = false
let allowClose = false
let quitting = false
let lastStatus = { message: '选择一个工程开始编辑。', logPath: '' }
const welcome = pathToFileURL(path.join(__dirname, 'welcome.html')).href
const resources = app.isPackaged ? path.join(process.resourcesPath, 'studio-resources') : path.join(__dirname, 'studio-resources')
const pnpm = app.isPackaged ? path.join(process.resourcesPath, 'pnpm/bin/pnpm.cjs') : path.join(__dirname, 'node_modules/pnpm/bin/pnpm.cjs')
function reportStatus(status) {
  lastStatus = { ...status, working }
  if (window && !window.isDestroyed()) window.webContents.send('studio:status', lastStatus)
}
const runtime = createRuntime({
  executable: process.execPath, pnpm, userData: app.getPath('userData'),
  onStatus: reportStatus,
})

async function showWelcome(message = '选择一个工程开始编辑。') {
  lastStatus = { message, logPath: runtime.logPath, working }
  await window.loadURL(welcome)
}

async function ensureSaved() {
  if (!current) return true
  let saved
  try {
    saved = await window.webContents.executeJavaScript('typeof window.__studioProject?.save === "function" ? window.__studioProject.save() : null')
  }
  catch { saved = false }
  if (saved === true) return true
  if (saved === false) {
    await dialog.showMessageBox(window, { type: 'warning', message: '当前工程尚未保存成功。', detail: '请在编辑器中检查保存状态，完成保存后再试。', buttons: ['返回编辑器'] })
    return false
  }
  const result = await dialog.showMessageBox(window, {
    type: 'question', message: '当前编辑器没有提供保存接口。',
    detail: '请先自行保存文件。继续将关闭当前编辑器；启用应用随附的 Studio 后可以自动完成保存。',
    buttons: ['取消', '已自行保存，继续'], defaultId: 0, cancelId: 0,
  })
  return result.response === 1
}

async function chooseDestination(title, defaultPath) {
  const result = await dialog.showSaveDialog(window, { title, defaultPath, buttonLabel: '选择工程文件夹' })
  return result.canceled ? null : result.filePath
}

async function chooseProject() {
  const result = await dialog.showOpenDialog(window, { title: '打开 Slidev 工程文件夹', properties: ['openDirectory'] })
  if (result.canceled) return null
  let entry = path.join(result.filePaths[0], 'slides.md')
  if (!await exists(entry)) {
    const file = await dialog.showOpenDialog(window, { title: '选择幻灯片入口', defaultPath: result.filePaths[0], properties: ['openFile'], filters: [{ name: 'Slidev Markdown', extensions: ['md'] }] })
    if (file.canceled) return null
    entry = file.filePaths[0]
  }
  return inspectProject(entry)
}

async function prepareExisting(project) {
  if (await hasBundledStudio(project, resources)) return { changed: false }
  const result = await dialog.showMessageBox(window, {
    type: 'question', message: '在这个工程中启用应用随附的 Studio？',
    detail: '将添加 vendor/slidev-addon-studio.tgz，并更新 package.json 中的 Studio 依赖及启用配置。保留现有 Slidev、主题、Vue 版本和文稿；随后使用内置 pnpm 准备依赖。',
    buttons: ['启用随附 Studio', '保留工程现有环境', '取消'], defaultId: 0, cancelId: 2,
  })
  if (result.response === 2) return null
  if (result.response === 1) return { changed: false }
  return { changed: true, enable: true }
}

async function openPrepared(project, { changed = false, enable = false } = {}) {
  const managed = enable || await hasBundledStudio(project, resources)
  const needsInstall = managed || changed || !await exists(path.join(project.root, 'node_modules/@slidev/cli/bin/slidev.mjs'))
  const otherLock = !await exists(path.join(project.root, 'pnpm-lock.yaml'))
    && (await exists(path.join(project.root, 'package-lock.json')) || await exists(path.join(project.root, 'yarn.lock')))
  if (needsInstall && otherLock) {
    const result = await dialog.showMessageBox(window, {
      type: 'question', message: '使用内置 pnpm 准备这个工程的依赖？',
      detail: '将从现有 npm/Yarn 锁文件生成 pnpm-lock.yaml，保留原锁文件。若不想转换，请取消并在外部准备好依赖后打开。',
      buttons: ['取消', '转换并准备依赖'], defaultId: 0, cancelId: 0,
    })
    if (result.response !== 1) return false
  }
  if (enable) await enableStudio(project, resources)
  await runtime.stop()
  current = null
  await showWelcome('正在准备工程。')
  if (needsInstall) await runtime.install(project, { changed: changed || managed, importLock: otherLock })
  if (quitting) return false
  const origin = await runtime.start(project)
  current = { ...project, origin }
  await window.loadURL(`${origin}1?studio=1`)
  window.setTitle(`Slidev Studio — ${path.basename(project.root)}`)
  return true
}

async function perform(action) {
  if (action === 'logs') {
    if (runtime.logPath) await shell.openPath(runtime.logPath)
    return { ok: true }
  }
  if (!['new', 'open', 'save', 'saveAs', 'close'].includes(action)) return { ok: false, error: '不支持的工程操作。' }
  if (working) return { ok: false, error: '正在准备工程，请等待当前操作完成。' }
  working = true
  try {
    if (!await ensureSaved()) return { ok: false }
    if (action === 'save') return { ok: true }
    if (action === 'close') {
      await runtime.stop(); current = null
      await showWelcome()
      window.setTitle('Slidev Studio')
      return { ok: true }
    }
    let project
    let settings = { changed: false }
    if (action === 'new') {
      const destination = await chooseDestination('新建 Slidev 工程', path.join(app.getPath('documents'), '新的演示'))
      if (!destination) return { ok: false }
      reportStatus({ message: '正在创建工程文件。', logPath: runtime.logPath })
      project = await createProject(destination, resources)
      settings.changed = true
    }
    else if (action === 'open') {
      project = await chooseProject()
      if (!project) return { ok: false }
      if (current?.entry === project.entry) return { ok: true }
      settings = await prepareExisting(project)
      if (!settings) return { ok: false }
    }
    else {
      if (!current) return { ok: false, error: '请先打开一个工程。' }
      const destination = await chooseDestination('工程另存为', `${current.root}-副本`)
      if (!destination) return { ok: false }
      const response = await fetch(`${current.origin}@studio/project.zip`)
      if (!response.ok || !response.headers.get('Content-Type')?.includes('application/zip'))
        throw new Error('当前工程未能导出，请返回“文件”页核对错误信息。')
      const data = Buffer.from(await response.arrayBuffer())
      await saveProjectCopy(data, destination, current.root)
      project = await inspectProject(path.join(destination, path.relative(current.root, current.entry)))
    }
    return { ok: await openPrepared(project, settings) }
  }
  catch (error) {
    if (quitting || window.isDestroyed()) return { ok: false }
    const message = error instanceof Error ? error.message : String(error)
    await dialog.showMessageBox(window, { type: 'error', message: '工程操作未完成', detail: message, buttons: ['知道了'] })
    if (!current) await showWelcome(message)
    return { ok: false, error: message }
  }
  finally {
    working = false
    lastStatus.working = false
    if (window && !window.isDestroyed()) window.webContents.send('studio:status', lastStatus)
  }
}

async function quit() {
  if (quitting) return
  if (working) {
    const result = await dialog.showMessageBox(window, { type: 'question', message: '正在准备工程，确定停止并退出？', buttons: ['继续等待', '退出'], defaultId: 0, cancelId: 0 })
    if (result.response !== 1) return
  }
  else if (!await ensureSaved()) return
  quitting = true
  await runtime.stop()
  allowClose = true
  window.close()
}

app.whenReady().then(async () => {
  window = new BrowserWindow({
    width: 1440, height: 920, minWidth: 800, minHeight: 600, title: 'Slidev Studio', backgroundColor: '#202229',
    webPreferences: { preload: path.join(__dirname, 'preload.cjs'), nodeIntegration: false, contextIsolation: true, sandbox: true },
  })
  window.webContents.on('did-finish-load', () => window.webContents.send('studio:status', { ...lastStatus, working }))
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) void shell.openExternal(url)
    return { action: 'deny' }
  })
  window.webContents.on('will-navigate', (event, url) => {
    if (url !== welcome && (!current || new URL(url).origin !== new URL(current.origin).origin)) {
      event.preventDefault()
      if (/^https?:\/\//i.test(url)) void shell.openExternal(url)
    }
  })
  window.on('close', event => { if (!allowClose) { event.preventDefault(); void quit() } })
  ipcMain.handle('studio:project', (event, action) => {
    if (event.sender !== window.webContents || event.senderFrame !== window.webContents.mainFrame)
      throw new Error('工程操作只允许从主窗口发起。')
    return perform(action)
  })
  const command = (label, action, accelerator) => ({ label, accelerator, click: () => { void perform(action) } })
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    { label: '文件', submenu: [command('新建工程', 'new', 'Ctrl+N'), command('打开工程', 'open', 'Ctrl+O'), { type: 'separator' }, command('保存', 'save'), command('另存为', 'saveAs', 'Ctrl+Shift+S'), command('关闭工程', 'close'), { type: 'separator' }, { label: '退出', accelerator: 'Alt+F4', click: () => { void quit() } }] },
    // Studio/Tiptap own undo shortcuts; native undo roles would intercept them.
    { label: '编辑', submenu: [{ role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { role: 'selectAll' }] },
    { label: '帮助', submenu: [command('打开运行日志', 'logs'), { role: 'toggleDevTools', label: '开发者工具' }] },
  ]))
  await showWelcome()
})
app.on('window-all-closed', () => app.quit())
