import type { ResolvedSlidevOptions } from '@slidev/types'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, expect, it } from 'vitest'
import { listAssets, saveAsset } from '../node/assets'

const directories: string[] = []
afterEach(async () => {
  await Promise.all(directories.splice(0).map(dir => rm(dir, { recursive: true, force: true })))
})

it('preserves Chinese filenames and adds collision suffixes before the extension', async () => {
  const root = await mkdtemp(join(tmpdir(), 'studio-assets-'))
  directories.push(root)
  const options = { userRoot: root } as ResolvedSlidevOptions
  const data = Buffer.from([0xff, 0xd8, 0xff, 0xd9])
  const saved = []
  for (const name of ['活动海报.jpg', '活动海报.JPG', '活动海报.jpg'])
    saved.push(await saveAsset(options, { name, data: data.toString('base64') }))

  expect(saved.map(asset => asset.name)).toEqual(['活动海报.jpg', '活动海报-1.jpg', '活动海报-2.jpg'])
  expect(saved.map(asset => decodeURIComponent(asset.url))).toEqual(['/活动海报.jpg', '/活动海报-1.jpg', '/活动海报-2.jpg'])
  expect((await listAssets(options)).map(asset => asset.url).sort()).toEqual(saved.map(asset => asset.url).sort())
  for (const asset of saved)
    expect(await readFile(join(root, 'public', asset.name))).toEqual(data)
})

it('preserves an ordinary filename and adds collision suffixes before its extension', async () => {
  const root = await mkdtemp(join(tmpdir(), 'studio-assets-'))
  directories.push(root)
  const options = { userRoot: root } as ResolvedSlidevOptions
  const payload = { name: 'Photo.JPG', data: Buffer.from('image').toString('base64') }
  expect((await saveAsset(options, payload)).name).toBe('Photo.jpg')
  expect((await saveAsset(options, payload)).name).toBe('Photo-1.jpg')
})

it('encodes readable Unicode names and replaces unsupported URL delimiters', async () => {
  const root = await mkdtemp(join(tmpdir(), 'studio-assets-'))
  directories.push(root)
  const options = { userRoot: root } as ResolvedSlidevOptions
  const asset = await saveAsset(options, { name: '活动 #100%（最终版）.SVG', data: Buffer.from('<svg />').toString('base64'), dir: 'photos' })
  expect(asset.name).toBe('活动 -100-（最终版）.svg')
  expect(asset.url).toBe('/photos/%E6%B4%BB%E5%8A%A8%20-100-%EF%BC%88%E6%9C%80%E7%BB%88%E7%89%88%EF%BC%89.svg')
  expect(await listAssets(options)).toEqual([asset])
  expect(await readFile(join(root, 'public', 'photos', asset.name), 'utf8')).toBe('<svg />')
})

it('cleans Windows-invalid names while keeping the validated extension', async () => {
  const root = await mkdtemp(join(tmpdir(), 'studio-assets-'))
  directories.push(root)
  const options = { userRoot: root } as ResolvedSlidevOptions
  const saved = []
  for (const name of ['活动:海报?.jpg', '海报 .jpg', 'CON.jpg', '   .jpg'])
    saved.push((await saveAsset(options, { name, data: '' })).name)
  expect(saved).toEqual(['活动-海报-.jpg', '海报.jpg', 'asset-CON.jpg', 'asset.jpg'])
})
