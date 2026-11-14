<script setup lang="ts">
import { computed } from 'vue'
import { useElementProperties } from '../../composables/useElementProperties'
import { t } from '../../i18n'
import { busy, editing, selection } from '../../state'
import ColorSwatch from './ColorSwatch.vue'
import StudioField from './StudioField.vue'

defineProps<{ compact?: boolean }>()
const { element, style } = useElementProperties()
const color = computed(() => element.value?.styles.color || (selection.value ? getComputedStyle(selection.value.el).color : '#000000'))
function fontSize(value: string) {
  const size = Number(value)
  if (value.trim() && Number.isFinite(size))
    void style({ 'font-size': `${Math.min(200, Math.max(8, size))}px` })
}
const alignments = [{ value: 'left', label: 'alignLeft' }, { value: 'center', label: 'alignCenter' }, { value: 'right', label: 'alignRight' }] as const
</script>

<template>
  <fieldset v-if="element?.kind === 'text'" class="studio-element-fields" :class="{ 'studio-text-compact': compact }" :disabled="busy || editing" :title="editing ? t('finishEditing') : undefined">
    <StudioField v-if="!compact" :label="t('fontFamily')">
      <select :value="element.styles['font-family']" @change="style({ 'font-family': ($event.target as HTMLSelectElement).value || null })">
        <option value="">{{ t('followTheme') }}</option><option value="sans-serif">{{ t('sansSerif') }}</option><option value="serif">{{ t('serif') }}</option><option value="monospace">{{ t('monospace') }}</option>
      </select>
    </StudioField>
    <StudioField :label="t('fontSizePx')"><input type="number" min="8" max="200" step="1" :value="parseFloat(element.styles['font-size']) || 28" @change="fontSize(($event.target as HTMLInputElement).value)"></StudioField>
    <StudioField :label="t('textColor')">
      <span class="studio-color-field"><ColorSwatch :value="color" @change="style({ color: $event })" /><button v-if="!compact" class="studio-text-button" @click="style({ color: null })">{{ t('followTheme') }}</button></span>
    </StudioField>
    <StudioField :label="t('textAlignment')"><span class="studio-segmented"><button v-for="align in alignments" :key="align.value" :aria-pressed="(element.styles['text-align'] || 'left') === align.value" @click="style({ 'text-align': align.value })">{{ t(align.label) }}</button></span></StudioField>
    <StudioField v-if="!compact" :label="t('lineSpacing')"><select :value="element.styles['line-height'] || '1.3'" @change="style({ 'line-height': ($event.target as HTMLSelectElement).value })"><option v-for="value in [1, 1.3, 1.5, 2]" :key="value" :value="String(value)">{{ value }}</option></select></StudioField>
    <p v-if="!compact" class="studio-hint">{{ t('textBoxSizingHint') }}</p>
  </fieldset>
</template>
