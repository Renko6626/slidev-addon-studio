export const editorOpenStorageKey = 'slidev-studio:open'

export function editorOpenFromQuery(value: unknown, fallback: boolean): boolean {
  return value === '1' ? true : value === '0' ? false : fallback
}

/** Published presentations always run, regardless of authoring preferences. */
export function initialEditorOpen(value: unknown, preference: boolean, editorAvailable: boolean): boolean {
  return editorAvailable && editorOpenFromQuery(value, preference)
}
