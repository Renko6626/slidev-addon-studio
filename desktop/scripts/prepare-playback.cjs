const fs = require('node:fs/promises')
const path = require('node:path')
const { MINISERVE, digest, readPlayback } = require('../playback.cjs')

const templates = path.join(__dirname, '../playback')

async function preparePlayback({ resources, asset = MINISERVE, fetchImpl = fetch }) {
  const directory = path.join(resources, 'playback')
  const executable = path.join(directory, 'miniserve.exe')
  const cached = await fs.readFile(executable).catch(error => {
    if (error.code !== 'ENOENT') throw error
    return null
  })
  if (!cached || digest(cached) !== asset.sha256) {
    const response = await fetchImpl(asset.url)
    if (!response.ok) throw new Error(`无法取得网页播放资源（HTTP ${response.status}）。`)
    const bytes = Buffer.from(await response.arrayBuffer())
    if (digest(bytes) !== asset.sha256) throw new Error('下载的网页播放资源校验失败。')
    await fs.mkdir(directory, { recursive: true })
    await fs.writeFile(executable, bytes)
  }
  for (const name of ['start.cmd', 'README.txt', 'miniserve-LICENSE.txt'])
    await fs.copyFile(path.join(templates, name), path.join(directory, name))
  return readPlayback(resources, asset)
}

module.exports = { MINISERVE, preparePlayback, readPlayback }
