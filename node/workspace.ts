import type { WorkspaceContext } from '../shared/workspace'

export function readWorkspaceContext(value = process.env.SLIDEV_STUDIO_WORKSPACE_CONTEXT): WorkspaceContext | undefined {
  if (!value) return
  try {
    const context = JSON.parse(value)
    if (typeof context?.name !== 'string' || !context.name.trim() || typeof context.returnUrl !== 'string') return
    const url = new URL(context.returnUrl)
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) return
    return { name: context.name, returnUrl: url.href }
  }
  catch { return }
}
