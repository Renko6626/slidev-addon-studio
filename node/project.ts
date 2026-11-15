import type { ResolvedSlidevOptions } from '@slidev/types'
import type { ProjectFile, ProjectInfo } from '../shared/project'
import { readdir, readFile } from 'node:fs/promises'
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path'
import JSZip from 'jszip'
import { StudioError } from '../shared/errors'

const EXCLUDED_DIRS = new Set([
  'node_modules', '.git', 'dist', '.vite', '.cache', '.slidev', 'coverage',
  '.worktrees', '.superpowers', '.superdesign', '.local', '.pnpm-store',
])
const LOCAL_FILES = new Set(['.npmrc', '.yarnrc', '.yarnrc.yml', '.DS_Store', 'Thumbs.db'])
const ENV_EXAMPLES = new Set(['.env.example', '.env.sample', '.env.template'])

function excluded(name: string) {
  return EXCLUDED_DIRS.has(name) || LOCAL_FILES.has(name)
    || ((name === '.env' || name.startsWith('.env.')) && !ENV_EXAMPLES.has(name))
    || name.endsWith('.log')
}

function portable(path: string) { return path.split(sep).join('/') }
function outside(root: string, file: string) {
  const path = relative(root, file)
  return path === '..' || path.startsWith(`..${sep}`) || isAbsolute(path)
}

async function projectRoot(options: ResolvedSlidevOptions) {
  const start = dirname(resolve(options.entry))
  const boundary = resolve(options.userWorkspaceRoot || start)
  let current = start
  while (true) {
    try {
      const pkg = JSON.parse(await readFile(join(current, 'package.json'), 'utf8'))
      return { root: current, packageName: typeof pkg.name === 'string' ? pkg.name : '' }
    }
    catch (error: any) {
      if (error.code !== 'ENOENT') throw error
    }
    if (current === boundary || current === dirname(current) || outside(boundary, dirname(current)))
      return { root: start, packageName: '' }
    current = dirname(current)
  }
}

async function listFiles(root: string, directory = root): Promise<ProjectFile[]> {
  const entries = await readdir(directory, { withFileTypes: true })
  const files: ProjectFile[] = []
  for (const entry of entries) {
    if (excluded(entry.name)) continue
    const full = join(directory, entry.name)
    const file: ProjectFile = {
      name: entry.name, path: portable(relative(root, full)),
      kind: entry.isSymbolicLink() ? 'link' : entry.isDirectory() ? 'directory' : 'file',
    }
    if (entry.isDirectory()) file.children = await listFiles(root, full)
    if (entry.isFile() || entry.isDirectory() || entry.isSymbolicLink()) files.push(file)
  }
  return files.sort((a, b) => Number(b.kind === 'directory') - Number(a.kind === 'directory') || a.name.localeCompare(b.name))
}

export async function readProject(options: ResolvedSlidevOptions): Promise<ProjectInfo> {
  const { root, packageName } = await projectRoot(options)
  return {
    name: options.data.config.title || packageName || basename(root),
    root, entry: portable(relative(root, resolve(options.entry))), files: await listFiles(root),
  }
}

export async function exportProject(options: ResolvedSlidevOptions): Promise<{ filename: string, data: Buffer }> {
  const project = await readProject(options)
  // Imported Markdown outside the directory would leave a valid-looking but
  // incomplete archive. Report it instead of inventing a relocation scheme.
  for (const slide of options.data.slides) {
    const file = slide.source?.filepath
    if (file && outside(project.root, resolve(file)))
      throw new StudioError('projectExternalSource', `Slide source is outside the project: ${file}`, { path: file })
    if (file && portable(relative(project.root, resolve(file))).split('/').some(excluded))
      throw new StudioError('projectExcludedSource', `Slide source is excluded from the archive: ${file}`, { path: file })
  }
  const zip = new JSZip()
  async function add(files: ProjectFile[]) {
    for (const file of files) {
      if (file.kind === 'link')
        throw new StudioError('projectLinkedFile', `Move linked files into the project before exporting: ${file.path}`, { path: file.path })
      if (file.kind === 'directory') {
        zip.folder(file.path)
        await add(file.children ?? [])
      }
      else {
        zip.file(file.path, await readFile(join(project.root, file.path)))
      }
    }
  }
  await add(project.files)
  const name = project.name.replace(/[<>:"/\\|?*\x00-\x1f]/g, '-').replace(/[. ]+$/, '').trim().slice(0, 120) || 'slidev-project'
  return { filename: `${name}.zip`, data: await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' }) }
}
