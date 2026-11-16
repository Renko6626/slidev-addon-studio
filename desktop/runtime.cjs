const fs = require('node:fs')
const fsp = require('node:fs/promises')
const path = require('node:path')
const net = require('node:net')
const readline = require('node:readline')
const { spawn, execFile } = require('node:child_process')
const { promisify } = require('node:util')

async function nodeEnvironment(executable, userData, platform = process.platform, inherited = process.env) {
  const directory = path.join(userData, 'runtime-bin')
  await fsp.mkdir(directory, { recursive: true })
  if (platform === 'win32')
    await fsp.writeFile(path.join(directory, 'node.cmd'), `@echo off\r\nset "ELECTRON_RUN_AS_NODE=1"\r\n"${executable.replaceAll('%', '%%')}" %*\r\n`)
  else {
    const quoted = `'${executable.replaceAll("'", "'\\''")}'`
    await fsp.writeFile(path.join(directory, 'node'), `#!/bin/sh\nexport ELECTRON_RUN_AS_NODE=1\nexec ${quoted} "$@"\n`, { mode: 0o755 })
  }
  const inheritedPath = Object.entries(inherited).find(([key]) => key.toLowerCase() === 'path')?.[1] || ''
  const env = { ...inherited }
  for (const key of Object.keys(env)) if (key.toLowerCase() === 'path') delete env[key]
  return {
    ...env, PATH: directory + (platform === 'win32' ? ';' : ':') + inheritedPath,
    ELECTRON_RUN_AS_NODE: '1', npm_node_execpath: executable, NODE: executable,
    NODE_ENV: 'development', COREPACK_ENABLE_DOWNLOAD_PROMPT: '0', NO_COLOR: '1',
  }
}

async function freePort() {
  const server = net.createServer()
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve) })
  const port = server.address().port
  await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()))
  return port
}

function createRuntime({ executable, pnpm, userData, onStatus = () => {} }) {
  let child = null
  let exit = Promise.resolve()
  let logPath = ''
  const status = (message, detail = '') => onStatus({ message, detail, logPath })

  async function launch(args, root, onLine) {
    await fsp.mkdir(path.join(userData, 'logs'), { recursive: true })
    logPath = path.join(userData, 'logs', 'current-project.log')
    const output = fs.createWriteStream(logPath, { flags: 'a' })
    output.write(`\n[${new Date().toISOString()}] ${JSON.stringify([executable, ...args])}\n工作目录：${root}\n`)
    const env = await nodeEnvironment(executable, userData)
    const processChild = spawn(executable, args, {
      cwd: root, env, windowsHide: true, detached: process.platform !== 'win32',
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    child = processChild
    processChild.stdout.pipe(output, { end: false })
    processChild.stderr.pipe(output, { end: false })
    if (onLine) {
      for (const input of [processChild.stdout, processChild.stderr])
        readline.createInterface({ input, terminal: false, crlfDelay: Infinity }).on('line', onLine)
    }
    exit = new Promise((resolve, reject) => {
      processChild.once('error', error => { output.write(`${error.stack || error.message}\n`); reject(error) })
      processChild.once('close', (code, signal) => output.end(`\n进程结束：${code ?? signal}\n`, () => resolve(code)))
    })
    // A long-lived server is polled below, so handle its exit promise even if
    // startup fails before a caller awaits it.
    exit.catch(() => {})
    return processChild
  }

  async function runPnpm(project, args, message) {
    status(message)
    await launch([pnpm, '--config.manage-package-manager-versions=false', '--config.package-manager-strict=false', ...args], project.root, line => {
      const detail = line.trim()
      if (!detail) return
      const counts = detail.match(/Progress: resolved (\d+), reused (\d+), downloaded (\d+), added (\d+)/)
      status(message, counts ? `已解析 ${counts[1]} 个包，复用 ${counts[2]}，下载 ${counts[3]}，安装 ${counts[4]}` : detail)
    })
    const code = await exit
    child = null
    if (code !== 0) throw new Error(`依赖准备未完成（退出码 ${code}）。请查看日志：${logPath}`)
  }

  async function install(project, { changed = false, importLock = false, storeDir, offline = false } = {}) {
    const storeArgs = storeDir ? ['--store-dir', storeDir] : []
    if (offline) {
      await runPnpm(project, ['install', '--offline', '--frozen-lockfile', '--ignore-scripts', '--package-import-method=copy', ...storeArgs, '--reporter=append-only'], '正在从随附文件准备离线依赖，无需联网。')
      return
    }
    if (importLock) await runPnpm(project, ['import'], '正在读取工程的依赖锁文件。')
    const frozen = !changed && fs.existsSync(path.join(project.root, 'pnpm-lock.yaml'))
    await runPnpm(project, ['install', '--prefer-offline', ...storeArgs, '--reporter=append-only', frozen ? '--frozen-lockfile' : '--no-frozen-lockfile'], '正在准备项目依赖，优先使用本机缓存。')
  }

  async function start(project) {
    const message = '正在启动编辑器，首次编译可能需要一些时间。'
    status(message)
    const cli = path.join(project.root, 'node_modules', '@slidev', 'cli', 'bin', 'slidev.mjs')
    const port = await freePort()
    const server = await launch([cli, project.entry, '--port', String(port), '--remote', '--bind', '127.0.0.1', '--log', 'info'], project.root,
      line => { if (line.trim()) status(message, line.trim()) })
    const origin = `http://127.0.0.1:${port}/`
    const deadline = Date.now() + 180000
    const exited = exit.then(code => { throw new Error(`编辑器已退出（${code ?? server.signalCode}），请查看日志：${logPath}`) })
    exited.catch(() => {})
    try {
      while (Date.now() < deadline) {
        if (child !== server) throw new Error('编辑器启动已取消。')
        const ready = await Promise.race([
          exited,
          fetch(origin, { signal: AbortSignal.timeout(Math.max(1, Math.min(10000, deadline - Date.now()))) })
            .then(response => response.ok && response.headers.get('Content-Type')?.includes('text/html'))
            .catch(() => false),
        ])
        if (ready) return origin
        await new Promise(resolve => setTimeout(resolve, 200))
      }
      throw new Error(`编辑器启动超过 3 分钟，请查看日志：${logPath}`)
    }
    catch (error) {
      await stop()
      throw error
    }
  }

  async function stop() {
    const running = child
    child = null
    if (!running || running.exitCode !== null) return
    if (process.platform === 'win32') {
      const taskkill = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'taskkill.exe')
      await promisify(execFile)(taskkill, ['/pid', String(running.pid), '/T', '/F'], { windowsHide: true }).catch(() => {})
    }
    else {
      try { process.kill(-running.pid, 'SIGTERM') } catch {}
    }
    await Promise.race([exit.catch(() => {}), new Promise(resolve => setTimeout(resolve, 3000))])
    if (running.exitCode === null) {
      try {
        if (process.platform === 'win32') running.kill()
        else process.kill(-running.pid, 'SIGKILL')
      }
      catch {}
    }
  }

  return { install, start, stop, get logPath() { return logPath } }
}

module.exports = { nodeEnvironment, createRuntime }
