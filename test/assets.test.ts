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

it('keeps the image extension when non-ASCII filenames collide after sanitization', async () => {
  const root = await mkdtemp(join(tmpdir(), 'studio-assets-'))
  directories.push(root)
  const options = { userRoot: root } as ResolvedSlidevOptions
  const data = Buffer.from([0xff, 0xd8, 0xff, 0xd9])
  const saved = []
  for (const name of ['图片.jpg', '照片.JPG', '背景.jpg'])
    saved.push(await saveAsset(options, { name, data: data.toString('base64') }))

  expect(saved.map(asset => asset.name)).toEqual(['asset.jpg', 'asset-1.jpg', 'asset-2.jpg'])
  expect(saved.map(asset => asset.url)).toEqual(['/asset.jpg', '/asset-1.jpg', '/asset-2.jpg'])
  expect((await listAssets(options)).map(asset => asset.url).sort()).toEqual(saved.map(asset => asset.url).sort())
  for (const asset of saved)
    expect(await readFile(join(root, 'public', asset.name))).toEqual(data)
})

it('preserves an ordinary filename and adds collision suffixes before its extension', async () => {
  const root = await mkdtemp(join(tmpdir(), 'studio-assets-'))
  directories.push(root)
  const options = { userRoot: root } as ResolvedSlidevOptions
  const payload = { name: 'Photo.JPG', data: Buffer.from('image').toString('base64') }
  expect((await saveAsset(options, payload)).name).toBe('photo.jpg')
  expect((await saveAsset(options, payload)).name).toBe('photo-1.jpg')
})
