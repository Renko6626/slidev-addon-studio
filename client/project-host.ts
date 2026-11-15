export type ProjectHostAction = 'new' | 'open' | 'saveAs' | 'close'
export interface ProjectHost {
  perform: (action: ProjectHostAction) => Promise<{ ok: boolean, error?: string }>
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
