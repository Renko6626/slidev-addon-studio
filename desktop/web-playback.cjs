const fs = require('node:fs/promises')
const { createWriteStream } = require('node:fs')
const path = require('node:path')
const os = require('node:os')
const { spawn, execFile } = require('node:child_process')
const { promisify } = require('node:util')
const JSZip = require('jszip')
const { nodeEnvironment } = require('./runtime.cjs')
const { readPlayback } = require('./playback.cjs')

async function runWebPlaybackExport({ chooseDestination, save, build }) {
  try {
    const destination = await chooseDestination()
    if (!destination || !await save()) return { ok: false }
    await build(destination)
    return { ok: true }
  }
  catch (error) { return { ok: false, error: error instanceof Error ? error.message : String(error) } }
}

/** Owns one export process; never touches the runtime's editing server. */
function createWebPlaybackExporter({ executable, userData, playbackAsset }) {
  let active = null

  async function exportWeb(project, destination, resources, logPath) {
    if (active) throw new Error('正在导出网页播放包，请等待完成。')
    let finish
    const job = { child: null, cancelled: false, done: new Promise(resolve => { finish = resolve }) }
    active = job
    let temporary, log
    try {
      const playback = await readPlayback(resources, playbackAsset)
      temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'studio-web-playback-'))
      const web = path.join(temporary, 'web')
      const cli = path.join(project.root, 'node_modules/@slidev/cli/bin/slidev.mjs')
      const args = [cli, 'build', project.entry, '--base', '/', '--without-notes', '--download', 'false', '--out', web]
      const env = { ...await nodeEnvironment(executable, userData), NODE_ENV: 'production' }
      const logFile = logPath || path.join(userData, 'logs/current-project.log')
      await fs.mkdir(path.dirname(logFile), { recursive: true })
      log = createWriteStream(logFile, { flags: 'a' })
      // Observe stream failures while the process runs, then report after it exits.
      let logError
      log.on('error', error => { logError = error })
      log.write(`\n[网页播放包] ${JSON.stringify([executable, ...args])}\n工作目录：${project.root}\n`)
      if (job.cancelled) throw new Error('网页播放包导出已停止。')
      const child = spawn(executable, args, { cwd: project.root, env, windowsHide: true, detached: process.platform !== 'win32', stdio: ['ignore', 'pipe', 'pipe'] })
      job.child = child
      child.stdout.pipe(log, { end: false })
      child.stderr.pipe(log, { end: false })
      const code = await new Promise((resolve, reject) => {
        child.once('error', reject)
        child.once('close', resolve)
      })
      if (job.cancelled) throw new Error('网页播放包导出已停止。')
      if (code !== 0) throw new Error(`网页构建失败（退出码 ${code}），请查看运行日志：${logFile}`)
      if (logError) throw logError
      await fs.access(path.join(web, 'index.html'))

      const zip = new JSZip()
      async function add(directory, prefix) {
        for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
          const file = path.join(directory, entry.name), name = `${prefix}/${entry.name}`
          if (entry.isDirectory()) await add(file, name)
          else zip.file(name, await fs.readFile(file))
        }
      }
      await add(web, 'web')
      for (const [name, file] of Object.entries({
        'miniserve.exe': playback.executable,
        'start.cmd': playback.launcher,
        'README.txt': playback.readme,
        'licenses/miniserve-LICENSE.txt': playback.license,
      })) zip.file(name, await fs.readFile(file))
      const bytes = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' })
      if (job.cancelled) throw new Error('网页播放包导出已停止。')
      await fs.writeFile(destination, bytes)
      log.write(`网页播放包已写入：${destination}\n`)
    }
    finally {
      try {
        if (log && !log.destroyed) await new Promise(resolve => log.end(resolve))
        if (temporary) await fs.rm(temporary, { recursive: true, force: true })
      }
      finally { active = null; finish() }
    }
  }

  async function stop() {
    const job = active
    if (!job) return
    job.cancelled = true
    const child = job.child
    if (child?.pid && child.exitCode === null && child.signalCode === null) {
      if (process.platform === 'win32') {
        const taskkill = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32/taskkill.exe')
        await promisify(execFile)(taskkill, ['/pid', String(child.pid), '/T', '/F'], { windowsHide: true }).catch(() => child.kill())
      }
      else {
        try { process.kill(-child.pid, 'SIGKILL') }
        catch (error) { if (error.code !== 'ESRCH') throw error }
      }
    }
    await job.done
  }

  return { export: exportWeb, stop }
}

module.exports = { createWebPlaybackExporter, runWebPlaybackExport }
