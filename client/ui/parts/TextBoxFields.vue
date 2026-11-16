<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRafFn } from '@vueuse/core'
import { useStudio } from '../../context'
import { busy, editing, selection, reportError } from '../../state'
import { action, t } from '../../i18n'
import { patchTextBoxLayout, readTextBoxLayout } from '../../md/elements'
import type { TextBoxLayout } from '../../md/elements'
import StudioField from './StudioField.vue'

const studio = useStudio()
const layout = computed(() => selection.value?.range ? readTextBoxLayout(studio.content(), selection.value.range) : null)
const overflow = ref(false)
useRafFn(() => {
  const el = selection.value?.el
  if (!el || layout.value?.height == null) { overflow.value = false; return }
  const child = el.querySelector<HTMLElement>(':scope > [data-studio-text-content]')
  const style = getComputedStyle(el)
  overflow.value = el.scrollWidth > el.clientWidth + 1 || (child ? child.offsetHeight + Number.parseFloat(style.paddingTop) + Number.parseFloat(style.paddingBottom) > el.clientHeight + 1 : el.scrollHeight > el.clientHeight + 1)
})
async function patch(value: Parameters<typeof patchTextBoxLayout>[2]) {
  const range = selection.value?.range
  if (!range || busy.value || editing.value) return
  try { await studio.commit(patchTextBoxLayout(studio.content(), range, value), action('actionElementFormat')) }
  catch (error) { reportError(error) }
}
function sizing(event: Event) {
  const fixed = (event.target as HTMLSelectElement).value === 'fixed'
  void patch({ height: fixed ? Math.max(1, Math.ceil(selection.value?.el.offsetHeight ?? 100)) : null })
}
function padding(side: keyof TextBoxLayout['padding'], event: Event) {
  const value = (event.target as HTMLInputElement).valueAsNumber
  if (Number.isFinite(value) && value >= 0) void patch({ padding: { [side]: value } })
}
</script>

<template>
  <fieldset v-if="layout" class="studio-element-fields" :disabled="busy || editing">
    <h3 class="studio-section__title">{{ t('textBoxLayout') }}</h3>
    <StudioField :label="t('textBoxSizing')"><select :value="layout.height === null ? 'auto' : 'fixed'" @change="sizing"><option value="auto">{{ t('textBoxAutoHeight') }}</option><option value="fixed">{{ t('textBoxFixed') }}</option></select></StudioField>
    <StudioField :label="t('textBoxVertical')"><select :value="layout.vertical" :disabled="layout.height === null" @change="patch({ vertical: ($event.target as HTMLSelectElement).value as TextBoxLayout['vertical'] })"><option value="top">{{ t('textBoxTop') }}</option><option value="middle">{{ t('textBoxMiddle') }}</option><option value="bottom">{{ t('textBoxBottom') }}</option></select></StudioField>
    <StudioField v-for="side in (['top', 'right', 'bottom', 'left'] as const)" :key="side" :label="t(`textBoxPadding${side === 'top' ? 'Top' : side === 'right' ? 'Right' : side === 'bottom' ? 'Bottom' : 'Left'}`)"><input type="number" min="0" step="1" :value="layout.padding[side]" @change="padding(side, $event)"></StudioField>
    <p v-if="overflow" class="studio-file-error" role="status">{{ t('textBoxOverflow') }}</p>
  </fieldset>
</template>
