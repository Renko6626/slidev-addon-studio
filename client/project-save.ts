import { ref } from 'vue'

export const projectSavedAt = ref<number | null>(null)
export const projectWriteError = ref<string | null>(null)
export const projectWriteCount = ref(0)
export const projectSaving = ref(false)

// Observe writes already issued by Studio; this does not queue or retry them.
const writes = new Set<Promise<unknown>>()

export function trackProjectWrite<T>(write: () => Promise<T>): Promise<T> {
  projectWriteError.value = null
  const task = Promise.resolve().then(write).then(result => {
    projectSavedAt.value = Date.now()
    return result
  }, error => {
    projectWriteError.value = error instanceof Error ? error.message : String(error)
    throw error
  }).finally(() => {
    writes.delete(task)
    projectWriteCount.value = writes.size
  })
  writes.add(task)
  projectWriteCount.value = writes.size
  return task
}

export async function saveProject(apply?: () => Promise<void>): Promise<boolean> {
  if (projectSaving.value) return false
  projectSaving.value = true
  try {
    await Promise.all([...writes])
    await apply?.()
    await Promise.all([...writes])
    if (projectWriteError.value !== null) return false
    projectSavedAt.value = Date.now()
    return true
  }
  catch (error) {
    projectWriteError.value = error instanceof Error ? error.message : String(error)
    return false
  }
  finally {
    projectSaving.value = false
  }
}

export function projectSaveStatus(draft = false) {
  if (projectSaving.value || projectWriteCount.value) return 'projectSaving'
  if (projectWriteError.value) return 'projectSaveFailed'
  if (draft) return 'projectDraft'
  return projectSavedAt.value ? 'projectSaved' : 'projectAutosave'
}
