<script setup lang="ts">
import { computed } from 'vue'
import StudioShape from '../../components/StudioShape.vue'
import { presetShape } from '../../shared/shapes'
import { useStudio } from '../context'
import { t } from '../i18n'
const studio = useStudio()
const { drawing, drawnBox } = studio.shapes
const shape = computed(() => drawing.value ? presetShape(drawing.value) : null)
const style = computed(() => {
  if (!drawnBox.value) return {}
  const box = drawnBox.value
  return { ...studio.canvas.toScreen(box), transform: `rotate(${box.rotate}deg)` }
})
const previewProps = computed(() => shape.value ? { ...shape.value, radius: shape.value.radius * studio.canvas.scale.value, strokeWidth: shape.value.strokeWidth * studio.canvas.scale.value } : {})
</script>
<template>
  <template v-if="drawing">
    <div class="studio-shape-drawing" :style="{ left: `${studio.canvas.rect.value.left}px`, top: `${studio.canvas.rect.value.top}px`, width: `${studio.canvas.rect.value.width}px`, height: `${studio.canvas.rect.value.height}px` }" @pointerdown="studio.shapes.beginDraw" />
    <div v-if="drawnBox" class="studio-shape-preview" :style="style"><StudioShape v-bind="previewProps" style="width:100%;height:100%" /></div>
    <div class="studio-shape-instruction">{{ t('shapeDrawHint') }} <button @click="studio.shapes.cancel()">{{ t('cancel') }}</button></div>
  </template>
</template>
