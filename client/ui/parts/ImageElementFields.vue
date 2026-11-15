<script setup lang="ts">
import { computed } from 'vue'
import { useElementProperties } from '../../composables/useElementProperties'
import { imagePending, useImageInsertion } from '../../composables/useImageInsertion'
import { t } from '../../i18n'
import { busy, editing } from '../../state'
import { readImagePosition } from '../../md/elements'
import StudioField from './StudioField.vue'

const { element, style, attribute } = useElementProperties()
const images = useImageInsertion()
const position = computed(() => readImagePosition(element.value?.styles['object-position'] || 'center'))

function setPosition(axis: 'x' | 'y', event: Event) {
  const value = (event.target as HTMLInputElement).valueAsNumber
  if (!Number.isFinite(value)) return
  const next = { ...position.value, [axis]: Math.min(100, Math.max(0, value)) }
  return style({ 'object-position': `${next.x}% ${next.y}%` })
}
</script>

<template>
  <fieldset v-if="element?.kind === 'image'" class="studio-element-fields" :disabled="busy || editing || imagePending">
    <h3 class="studio-section__title">{{ t('replaceImage') }}</h3>
    <div class="studio-button-row"><button class="studio-button" @click="images.fromFile(true)">{{ t('imageFromFile') }}</button><button class="studio-button" @click="images.fromLibrary(true)">{{ t('imageFromLibrary') }}</button></div>
    <StudioField :label="t('imageDisplay')"><select :value="element.styles['object-fit'] || 'contain'" @change="style({ 'object-fit': ($event.target as HTMLSelectElement).value })"><option value="contain">{{ t('imageContain') }}</option><option value="cover">{{ t('imageCover') }}</option></select></StudioField>
    <template v-if="element.styles['object-fit'] === 'cover'">
      <StudioField :label="t('imagePositionX')"><input type="number" min="0" max="100" :value="position.x" @change="setPosition('x', $event)"></StudioField>
      <StudioField :label="t('imagePositionY')"><input type="number" min="0" max="100" :value="position.y" @change="setPosition('y', $event)"></StudioField>
      <button class="studio-button" @click="style({ 'object-position': '50% 50%' })">{{ t('imagePositionCenter') }}</button>
      <p class="studio-hint">{{ t('imagePositionHint') }}</p>
    </template>
    <StudioField :label="t('lockRatio')"><input type="checkbox" :checked="element.lockRatio" @change="attribute('data-studio-lock-ratio', ($event.target as HTMLInputElement).checked ? null : 'false')"></StudioField>
    <StudioField :label="t('altText')"><input type="text" :value="element.alt" @change="attribute('alt', ($event.target as HTMLInputElement).value)"></StudioField>
    <p class="studio-hint">{{ t('imageDisplayHint') }}</p>
  </fieldset>
</template>
