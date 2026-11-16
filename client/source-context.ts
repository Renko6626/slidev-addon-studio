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

/** An inventory for the agent to inspect, not a dependency graph. */
export function projectScripts(files: ProjectFile[]): string[] {
  return files.flatMap(file => file.kind === 'directory' ? projectScripts(file.children ?? [])
    : file.kind === 'file' && /\.(?:ts|tsx|mts|cts)$/i.test(file.name) ? [file.path] : []).sort()
}

export function agentSourceContext(input: {
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
    '请在这个 Slidev Studio 工程中完成接下来的修改。',
    `工程目录：${input.project?.root ?? '尚未取得工程目录'}`,
    `入口文件：${input.project?.entry ?? '未知'}`,
    `当前页：第 ${input.no} 页`,
    `当前页源码：${location}`,
    ...(input.component ? [`选中组件：${input.component.name}`, `组件定义：${input.component.file}`, `组件来源：${input.component.source}`] : []),
    '',
    '先阅读工程 AGENTS.md 和 node_modules/slidev-addon-studio/skills/studio-authoring/SKILL.md。',
    '保留用户已经调整的 v-drag、文字、图片和无关样式；局部修改，不重新生成整份文稿。',
    '常改文字和图片保留 Studio 编辑入口。依赖目录中的组件先查看来源，不直接修改安装包。',
    '沿用工程现有检查，报告修改及实际结果。',
    ...(input.error ? ['', '最近错误（请结合当前文件确认是否仍存在）：', input.error] : []),
    ...(input.selectedSource ? ['', '选中对象的页面源码：', input.selectedSource] : []),
    '', '当前页原始 Markdown：', page.markdown,
  ].join('\n')
}
