import { computed } from 'vue'
import { useStudio } from '../context'
import { action } from '../i18n'
import { patchElementAttribute, patchElementStyle, readElement } from '../md/elements'
import { busy, editing, selection } from '../state'

/** The ribbon and inspector share the same small, source-backed operations. */
export function useElementProperties() {
  const studio = useStudio()
  const element = computed(() => selection.value?.range ? readElement(studio.content(), selection.value.range) : null)
  async function style(patch: Record<string, string | null>) {
    const range = selection.value?.range
    if (!range || busy.value || editing.value) return
    await studio.commit(patchElementStyle(studio.content(), range, patch), action('actionElementFormat'))
  }
  async function attribute(name: string, value: string | null) {
    const range = selection.value?.range
    if (!range || busy.value || editing.value) return
    await studio.commit(patchElementAttribute(studio.content(), range, name, value), action('actionElementFormat'))
  }
  return { element, style, attribute }
}
