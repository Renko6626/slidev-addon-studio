<script setup lang="ts">
import { useElementProperties } from '../../composables/useElementProperties'
import { imagePending, useImageInsertion } from '../../composables/useImageInsertion'
import { t } from '../../i18n'
import { busy, editing } from '../../state'
import StudioField from './StudioField.vue'

const { element, style, attribute } = useElementProperties()
const images = useImageInsertion()
</script>

<template>
  <fieldset v-if="element?.kind === 'image'" class="studio-element-fields" :disabled="busy || editing || imagePending">
    <h3 class="studio-section__title">{{ t('replaceImage') }}</h3>
    <div class="studio-button-row"><button class="studio-button" @click="images.fromFile(true)">{{ t('imageFromFile') }}</button><button class="studio-button" @click="images.fromLibrary(true)">{{ t('imageFromLibrary') }}</button></div>
    <StudioField :label="t('imageDisplay')"><select :value="element.styles['object-fit'] || 'contain'" @change="style({ 'object-fit': ($event.target as HTMLSelectElement).value })"><option value="contain">{{ t('imageContain') }}</option><option value="cover">{{ t('imageCover') }}</option></select></StudioField>
    <StudioField :label="t('lockRatio')"><input type="checkbox" :checked="element.lockRatio" @change="attribute('data-studio-lock-ratio', ($event.target as HTMLInputElement).checked ? null : 'false')"></StudioField>
    <StudioField :label="t('altText')"><input type="text" :value="element.alt" @change="attribute('alt', ($event.target as HTMLInputElement).value)"></StudioField>
    <p class="studio-hint">{{ t('imageDisplayHint') }}</p>
  </fieldset>
</template>
