import type { ProjectInfo } from '../../shared/project'
import { ref, shallowRef } from 'vue'
import { t } from '../i18n'
import { serverErrorText } from '../i18n/errors'

const BASE = `${import.meta.env.BASE_URL}@studio/`

async function check(response: Response) {
  if (response.ok) return
  const body = await response.json().catch(() => null)
  throw new Error(body?.error ? serverErrorText(body) : t('errorRequest', { status: response.status }))
}

export function useProject(save: () => Promise<boolean>) {
  const project = shallowRef<ProjectInfo | null>(null)
  const loading = ref(false)
  const downloading = ref(false)
  const exporting = ref(false)
  const error = ref<string | null>(null)

  async function refresh() {
    loading.value = true
    error.value = null
    try {
      const response = await fetch(`${BASE}project`, { cache: 'no-store' })
      await check(response)
      project.value = await response.json()
    }
    catch (cause) { error.value = cause instanceof Error ? cause.message : String(cause) }
    finally { loading.value = false }
  }

  async function download() {
    if (downloading.value) return
    downloading.value = true
    error.value = null
    try {
      if (!await save()) return
      const response = await fetch(`${BASE}project.zip`, { cache: 'no-store' })
      await check(response)
      if (!response.headers.get('Content-Type')?.includes('application/zip'))
        throw new Error(t('projectDownloadFailed'))
      const encoded = response.headers.get('Content-Disposition')?.match(/filename\*=UTF-8''([^;]+)/i)?.[1]
      const url = URL.createObjectURL(await response.blob())
      const link = document.createElement('a')
      link.href = url
      link.download = encoded ? decodeURIComponent(encoded) : 'slidev-project.zip'
      document.body.append(link)
      link.click()
      link.remove()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    }
    catch (cause) { error.value = cause instanceof Error ? cause.message : String(cause) }
    finally { downloading.value = false }
  }

  async function exportPresentation(open: () => unknown) {
    if (exporting.value) return
    exporting.value = true
    error.value = null
    try {
      if (await save()) await open()
    }
    catch (cause) { error.value = cause instanceof Error ? cause.message : String(cause) }
    finally { exporting.value = false }
  }

  return { project, loading, downloading, exporting, error, refresh, download, exportPresentation }
}
