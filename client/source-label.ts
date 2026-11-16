import type { StudioTarget } from './types'

/** Labels describe the authored block, including component tags stored in Markdown. */
export function sourceEditLabel(target: StudioTarget | null): 'editHtml' | 'editComponentTag' | 'editMarkdown' {
  if (target?.kind === 'component') return 'editComponentTag'
  return target?.tag ? 'editHtml' : 'editMarkdown'
}
