<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount, ref, shallowRef, watch } from 'vue'
import { useResizeObserver } from '@vueuse/core'
import { arrowHeadPath, dashArray, normalizeShape, shapePath } from '../shared/shapes'
import type { ShapeKind, ShapeOptions } from '../shared/shapes'

const props = withDefaults(defineProps<{
  kind?: ShapeKind
  fill?: string
  stroke?: string
  strokeWidth?: number
  dash?: 'solid' | 'dashed' | 'dotted'
  radius?: number
  head?: number
  shaft?: number
  startArrow?: boolean
  endArrow?: boolean
}>(), { kind: 'rect', fill: '#DBEAFE', stroke: '#2563EB', strokeWidth: 2, dash: 'solid', radius: 0, head: 0.3, shaft: 0.4, startArrow: false, endArrow: false })
const root = ref<HTMLElement | null>(null)
const size = ref({ w: 240, h: 160 })
const temporary = shallowRef<Partial<ShapeOptions> | null>(null)
const shape = computed(() => normalizeShape({ ...props, ...temporary.value }))
const path = computed(() => shapePath(shape.value, size.value.w, size.value.h))
useResizeObserver(root, entries => {
  const rect = entries[0]?.contentRect
  if (rect) size.value = { w: rect.width, h: rect.height }
})
function preview(event: Event) { temporary.value = (event as CustomEvent).detail ?? null }
onMounted(() => root.value?.addEventListener('studio-shape-preview', preview))
onBeforeUnmount(() => root.value?.removeEventListener('studio-shape-preview', preview))
watch(() => ({ ...props }), () => { temporary.value = null })
</script>

<template>
  <div ref="root" data-studio-element="shape" :data-studio-shape="shape.kind" class="studio-shape">
    <svg :viewBox="`0 0 ${size.w} ${size.h}`" width="100%" height="100%" style="display:block;overflow:visible" xmlns="http://www.w3.org/2000/svg">
      <path v-if="shape.kind === 'line'" :d="path" fill="none" stroke="transparent" :stroke-width="Math.max(14, shape.strokeWidth)" pointer-events="stroke" />
      <path :d="path" :fill="shape.kind === 'line' ? 'none' : shape.fill" :stroke="shape.stroke" :stroke-width="shape.strokeWidth" :stroke-dasharray="dashArray(shape)" stroke-linejoin="round" :stroke-linecap="shape.dash === 'dotted' ? 'round' : 'butt'" vector-effect="non-scaling-stroke" pointer-events="all" />
      <template v-if="shape.kind === 'line' && shape.strokeWidth > 0">
        <path v-if="shape.startArrow" :d="arrowHeadPath(size.w, size.h, shape.strokeWidth, true)" :fill="shape.stroke" pointer-events="all" />
        <path v-if="shape.endArrow" :d="arrowHeadPath(size.w, size.h, shape.strokeWidth, false)" :fill="shape.stroke" pointer-events="all" />
      </template>
    </svg>
  </div>
</template>

<style scoped>
.studio-shape { width:240px; height:160px; margin:0; padding:0; line-height:0; pointer-events:none; }
</style>

<studio lang="yaml">
hidden: true
</studio>
