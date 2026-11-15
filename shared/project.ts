export interface ProjectFile {
  name: string
  /** Relative to the project root, with forward slashes on every platform. */
  path: string
  kind: 'file' | 'directory' | 'link'
  children?: ProjectFile[]
}

export interface ProjectInfo {
  name: string
  /** A directory on the machine running the current Slidev service. */
  root: string
  entry: string
  files: ProjectFile[]
}
