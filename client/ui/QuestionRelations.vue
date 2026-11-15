<script setup lang="ts">
import { useRafFn } from '@vueuse/core'
import { ref } from 'vue'
import { useStudio } from '../context'
import { slideElement } from '../dom'
import { editing, selectedTargets, selection } from '../state'

const studio = useStudio()
const lines = ref<{ x1: number, y1: number, x2: number, y2: number }[]>([])

// Screen coordinates follow the existing selection overlay, including zoom and dragging.
// Connections are derived from the current slide's objects; they have no saved geometry.
useRafFn(() => {
  const selected = selection.value
  const root = slideElement(studio.no())
  if (editing.value || selectedTargets.value.length !== 1 || !selected || !root?.contains(selected.el)) {
    lines.value = []
    return
  }
  const id = selected.el.dataset.studioQuestionControl ?? selected.el.dataset.studioQuestionRef
  const controls = [...root.querySelectorAll<HTMLElement>('[data-studio-question-control]')].filter(el => el.dataset.studioQuestionControl === id)
  if (!id || controls.length !== 1) { lines.value = []; return }
  const control = controls[0]
  const children = selected.el === control
    ? [...root.querySelectorAll<HTMLElement>('[data-studio-question-ref]')].filter(el => el.dataset.studioQuestionRef === id)
    : [selected.el]
  const from = control.getBoundingClientRect()
  if (!from.width || !from.height) { lines.value = []; return }
  lines.value = children.flatMap(el => {
    const to = el.getBoundingClientRect()
    if (!to.width || !to.height) return []
    const below = to.top + to.height / 2 >= from.top + from.height / 2
    return [{ x1: from.left + from.width / 2, y1: below ? from.bottom : from.top,
      x2: to.left + to.width / 2, y2: below ? to.top : to.bottom }]
  })
})
</script>

<template>
  <svg v-if="lines.length" class="studio-question-relations" aria-hidden="true">
    <line v-for="(line, index) in lines" :key="index" v-bind="line" />
  </svg>
</template>

<style scoped>
.studio-question-relations { position: fixed; inset: 0; width: 100%; height: 100%; overflow: visible; pointer-events: none; z-index: 91; }
.studio-question-relations line { stroke: #64748b; stroke-width: 1.5; stroke-dasharray: 5 5; opacity: .7; }
</style>
