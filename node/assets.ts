import type { ResolvedSlidevOptions } from '@slidev/types'
import { Buffer } from 'node:buffer'
import { mkdir, readdir, stat, writeFile } from 'node:fs/promises'
import { basename, extname, join, resolve } from 'node:path'
import { StudioError } from '../shared/errors'
import { assetKind, assetLimitMiB } from '../shared/assets'
import type { AssetKind } from '../shared/assets'

/**
 * The asset drawer is backed by the deck's own `public/` directory, so an
 * image dropped onto a slide becomes a normal file the user can commit, and
 * the slide references it with a plain `/file.png` URL.
 */

export interface AssetEntry {
  /** URL to use inside a slide. */
  url: string
  name: string
  size: number
  kind: AssetKind
}

/** Where `public/` resolves to, which is the deck's directory, not the repo root. */
export function assetRoot(options: ResolvedSlidevOptions) {
  return join(options.userRoot, 'public')
}

export async function listAssets(options: ResolvedSlidevOptions): Promise<AssetEntry[]> {
  const root = assetRoot(options)
  const assets: AssetEntry[] = []

  let entries: Awaited<ReturnType<typeof readdir>>
  try {
    entries = await readdir(root, { withFileTypes: true, recursive: true }) as any
  }
  catch {
    return assets
  }

  for (const entry of entries as any[]) {
    if (!entry.isFile())
      continue
    const kind = assetKind(entry.name)
    if (!kind)
      continue
    const full = resolve(entry.parentPath ?? root, entry.name)
    const url = assetUrl(full.slice(root.length + 1))
    assets.push({ url, name: entry.name, size: (await stat(full)).size, kind })
  }

  return assets.sort((a, b) => a.name.localeCompare(b.name))
}

export interface UploadPayload {
  name: string
  /** Base64 payload, with or without a `data:` prefix. */
  data: string
  /** Optional sub-directory inside `public/`. */
  dir?: string
}

export async function saveAsset(options: ResolvedSlidevOptions, payload: UploadPayload): Promise<AssetEntry> {
  const file = basename(payload.name.replace(/\\/g, '/')).replace(/[ .]+$/, '')
  const ext = extname(file).toLowerCase()
  const kind = assetKind(file)
  if (!kind)
    throw new StudioError('unsupportedAssetType', `Unsupported file type "${ext || payload.name}"`, { type: ext || payload.name })

  const base64 = payload.data.includes(',') ? payload.data.slice(payload.data.indexOf(',') + 1) : payload.data
  const buffer = Buffer.from(base64, 'base64')
  const limit = assetLimitMiB(kind)
  if (buffer.byteLength > limit * 1024 * 1024)
    throw new StudioError('assetTooLarge', `File is larger than ${limit} MiB`, { size: limit })

  const publicRoot = assetRoot(options)
  const dir = sanitizeSegment(process.env.SLIDEV_STUDIO_ASSET_DIR ?? payload.dir ?? '')
  const targetDir = dir ? join(publicRoot, dir) : publicRoot
  await mkdir(targetDir, { recursive: true })

  const name = await uniqueName(targetDir, sanitizeFileName(file, ext))
  await writeFile(join(targetDir, name), buffer)

  return {
    url: assetUrl([dir, name].filter(Boolean).join('/')),
    name,
    size: buffer.byteLength,
    kind,
  }
}

function sanitizeFileName(file: string, ext: string) {
  // Preserve readable names; remove Windows-invalid characters and Vite URL delimiters.
  let stem = file.slice(0, file.length - ext.length)
    .replace(/[\u0000-\u001f<>:"/\\|?*#%]+/g, '-')
    .replace(/[ .]+$/, '') || 'asset'
  if (/^(con|prn|aux|nul|com[1-9¹²³]|lpt[1-9¹²³])(?:\.|$)/i.test(stem))
    stem = `asset-${stem}`
  return `${stem}${ext}`
}

/** File names stay readable on disk; URL syntax is escaped per path segment. */
function assetUrl(path: string) {
  return `/${path.split(/[\\/]/).map(encodeURIComponent).join('/')}`
}

function sanitizeSegment(dir: string) {
  return dir
    .split(/[\\/]/)
    .map(part => part.replace(/[^\w\-]+/g, ''))
    .filter(part => part && part !== '.' && part !== '..')
    .join('/')
}

async function uniqueName(dir: string, name: string) {
  const ext = extname(name)
  const stem = name.slice(0, name.length - ext.length)
  let candidate = name
  let counter = 1
  while (await exists(join(dir, candidate))) {
    candidate = `${stem}-${counter}${ext}`
    counter += 1
  }
  return candidate
}

async function exists(path: string) {
  try {
    await stat(path)
    return true
  }
  catch {
    return false
  }
}
