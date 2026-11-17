const fs = require('node:fs')
const path = require('node:path')
const { compareStudioVersions } = require('./studio-packages.cjs')

const RELEASES_URL = 'https://github.com/Renko6626/slidev-addon-studio/releases'
const RELEASES_API = 'https://api.github.com/repos/Renko6626/slidev-addon-studio/releases'

function validateInfo(info) {
  compareStudioVersions(info.desktopVersion, info.desktopVersion)
  compareStudioVersions(info.studioVersion, info.studioVersion)
  if (typeof info.notes !== 'string' || !info.notes.trim()) throw new Error('客户端更新日志为空，请重新准备客户端资源。')
  return info
}

function readDesktopRelease(root) {
  const desktopVersion = JSON.parse(fs.readFileSync(path.join(root, 'desktop/package.json'), 'utf8')).version
  const studioVersion = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).version
  compareStudioVersions(desktopVersion, desktopVersion)
  const notes = fs.readFileSync(path.join(root, 'docs/releases', `desktop-${desktopVersion}.md`), 'utf8')
  return validateInfo({ desktopVersion, studioVersion, notes })
}

function readBundledDesktopRelease(resources) {
  return validateInfo(JSON.parse(fs.readFileSync(path.join(resources, 'desktop-release.json'), 'utf8')))
}

async function checkDesktopRelease({ fetchImpl = globalThis.fetch, timeoutMs = 15000 } = {}) {
  const signal = AbortSignal.timeout(timeoutMs)
  let selected = null
  let page = 1
  while (true) {
    const response = await fetchImpl(`${RELEASES_API}?per_page=100&page=${page}`, {
      signal, headers: { Accept: 'application/vnd.github+json' },
    })
    if (!response.ok) throw new Error(`未能检查客户端更新（HTTP ${response.status}）。`)
    const releases = await response.json()
    if (!Array.isArray(releases)) throw new Error('发布服务器返回的客户端列表格式不正确。')
    for (const release of releases) {
      const version = release.tag_name?.match(/^desktop-v((?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*))$/)?.[1]
      if (!version || release.draft || release.prerelease) continue
      const zip = `Slidev-Studio-${version}-win32-x64-online.zip`
      if (!release.assets?.some(asset => asset.name === zip && asset.state === 'uploaded')) continue
      if (!selected || compareStudioVersions(version, selected.version) > 0) {
        selected = { version, notes: typeof release.body === 'string' ? release.body : '', url: `${RELEASES_URL}/tag/desktop-v${version}` }
      }
    }
    if (!/rel="?next"?(?:\s|,|;|$)/.test(response.headers.get('link') || '')) return selected
    page++
  }
}

module.exports = { RELEASES_URL, readDesktopRelease, readBundledDesktopRelease, checkDesktopRelease }
