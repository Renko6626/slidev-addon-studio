import type { SlideInfo } from '@slidev/types'
import type { ComponentEntry } from '../shared/catalog'
import type { ProjectFile, ProjectInfo } from '../shared/project'

export function pageSource(slide: SlideInfo | null) {
  const source = slide?.source
  return {
    file: source?.filepath ?? '',
    line: source && Number.isInteger(source.start) && source.start >= 0 ? source.start + 1 : null,
    markdown: source?.raw ?? '',
  }
}

/** Project script inventory; no page dependency inference. */
export function projectScripts(files: ProjectFile[]): string[] {
  return files.flatMap(file => file.kind === 'directory' ? projectScripts(file.children ?? [])
    : file.kind === 'file' && /\.(?:ts|tsx|mts|cts)$/i.test(file.name) ? [file.path] : []).sort()
}

export function pageSourceInfo(input: {
  no: number
  slide: SlideInfo | null
  project: ProjectInfo | null
  component?: Pick<ComponentEntry, 'name' | 'file' | 'source'> | null
  selectedSource?: string
  error?: string | null
}) {
  const page = pageSource(input.slide)
  const location = page.file ? page.file + (page.line === null ? '' : `:${page.line}`) : '尚未取得源码位置'
  return [
    'Slidev Studio 页面信息',
    `工程目录：${input.project?.root ?? '尚未取得工程目录'}`,
    `入口文件：${input.project?.entry ?? '未知'}`,
    `当前页：第 ${input.no} 页`,
    `当前页源码：${location}`,
    ...(input.component ? [`选中组件：${input.component.name}`, `组件定义：${input.component.file}`, `组件来源：${input.component.source}`] : []),
    ...(input.error ? ['', '最近错误：', input.error] : []),
    ...(input.selectedSource ? ['', '选中对象的页面源码：', input.selectedSource] : []),
    '', '当前页原始 Markdown：', page.markdown,
  ].join('\n')
}
