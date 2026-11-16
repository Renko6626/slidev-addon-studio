export type ProjectHostAction = 'new' | 'open' | 'saveAs' | 'close' | 'openFolder' | 'logs'
export interface ProjectHost {
  nativeProjectManagement?: boolean
  perform: (action: ProjectHostAction) => Promise<{ ok: boolean, error?: string }>
  studioUpdate?: () => Promise<{ ok: boolean, error?: string }>
  importProject?: () => Promise<{ ok: boolean, error?: string }>
}

declare global {
  interface Window {
    studioDesktop?: ProjectHost
    __studioProject?: { save: () => Promise<boolean> }
  }
}

export function projectHost(): ProjectHost | undefined {
  return typeof window === 'undefined' ? undefined : window.studioDesktop
}
