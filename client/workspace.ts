import type { WorkspaceContext } from '../shared/workspace'

export async function returnToActivity(workspace: WorkspaceContext, save: () => Promise<boolean>, navigate: (url: string) => unknown = url => window.location.assign(url)) {
  if (await save()) await navigate(workspace.returnUrl)
}
