const fs = require('node:fs/promises')
const path = require('node:path')
const { createHash } = require('node:crypto')
const MINISERVE = require('./playback/miniserve.json')

const digest = bytes => createHash('sha256').update(bytes).digest('hex')

async function readPlayback(resources, asset = MINISERVE) {
  const directory = path.join(resources, 'playback')
  const files = {
    executable: path.join(directory, 'miniserve.exe'),
    launcher: path.join(directory, 'start.cmd'),
    readme: path.join(directory, 'README.txt'),
    license: path.join(directory, 'miniserve-LICENSE.txt'),
  }
  const bytes = await fs.readFile(files.executable).catch(() => { throw new Error('缺少网页播放资源，请重新准备或安装桌面程序。') })
  if (digest(bytes) !== asset.sha256) throw new Error('网页播放资源校验失败，请重新准备或安装桌面程序。')
  await Promise.all([files.launcher, files.readme, files.license].map(file => fs.access(file)))
  return files
}

module.exports = { MINISERVE, digest, readPlayback }
