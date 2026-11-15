<script setup lang="ts">
import { useStudio } from '../../context'
import { t } from '../../i18n'
import { busy, editing } from '../../state'
import StudioField from './StudioField.vue'
import ColorSwatch from './ColorSwatch.vue'
const { shapes } = useStudio()
const { parameters, set, adjusting } = shapes
</script>
<template>
  <fieldset v-if="parameters" class="studio-element-fields" :disabled="busy || editing || adjusting">
    <h3 class="studio-section__title">{{ t('shapeStyle') }}</h3>
    <StudioField v-if="parameters.kind !== 'line'" :label="t('shapeFill')"><ColorSwatch :value="parameters.fill" @change="set({ fill: $event })" /><button class="studio-text-button" @click="set({ fill: 'none' })">{{ t('shapeNoFill') }}</button></StudioField>
    <StudioField :label="t('shapeStroke')"><ColorSwatch :value="parameters.stroke" @change="set({ stroke: $event })" /></StudioField>
    <StudioField :label="t('shapeStrokeWidth')"><input type="number" min="0" max="40" step="0.5" :value="parameters.strokeWidth" @change="set({ strokeWidth: Number(($event.target as HTMLInputElement).value) })"></StudioField>
    <StudioField :label="t('shapeDash')"><select :value="parameters.dash" @change="set({ dash: ($event.target as HTMLSelectElement).value as 'solid' | 'dashed' | 'dotted' })"><option value="solid">{{ t('shapeSolid') }}</option><option value="dashed">{{ t('shapeDashed') }}</option><option value="dotted">{{ t('shapeDotted') }}</option></select></StudioField>
    <StudioField v-if="parameters.kind === 'rect'" :label="t('shapeRadius')"><input type="number" min="0" max="1000" :value="parameters.radius" @change="set({ radius: Number(($event.target as HTMLInputElement).value) })"></StudioField>
    <template v-if="parameters.kind === 'line'">
      <StudioField :label="t('shapeStartArrow')"><input type="checkbox" :checked="parameters.startArrow" @change="set({ startArrow: ($event.target as HTMLInputElement).checked })"></StudioField>
      <StudioField :label="t('shapeEndArrow')"><input type="checkbox" :checked="parameters.endArrow" @change="set({ endArrow: ($event.target as HTMLInputElement).checked })"></StudioField>
    </template>
    <template v-if="parameters.kind === 'arrow'">
      <StudioField :label="t('shapeHead')"><input type="number" min="10" max="80" :value="Math.round(parameters.head * 100)" @change="set({ head: Number(($event.target as HTMLInputElement).value) / 100 })"></StudioField>
      <StudioField :label="t('shapeShaft')"><input type="number" min="10" max="90" :value="Math.round(parameters.shaft * 100)" @change="set({ shaft: Number(($event.target as HTMLInputElement).value) / 100 })"></StudioField>
    </template>
    <p class="studio-hint">{{ t(parameters.kind === 'line' ? 'shapeLineHint' : 'shapeHandleHint') }}</p>
  </fieldset>
</template>
