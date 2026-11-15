<script setup lang="ts">
import { shapePresets, presetShape, shapePath, arrowHeadPath } from '../../../shared/shapes'
import type { ShapePreset } from '../../../shared/shapes'
import { useStudio } from '../../context'
import { t } from '../../i18n'
import type { MessageKey } from '../../i18n'
import { busy, editing } from '../../state'
const studio = useStudio()
const labels: Record<ShapePreset, MessageKey> = { rect: 'shapeRect', roundRect: 'shapeRoundRect', ellipse: 'shapeEllipse', triangle: 'shapeTriangle', diamond: 'shapeDiamond', hexagon: 'shapeHexagon', line: 'shapeLine', lineArrow: 'shapeLineArrow', doubleArrow: 'shapeDoubleArrow', arrow: 'shapeBlockArrow' }
const items = shapePresets.map(id => ({ id, shape: presetShape(id), label: labels[id] }))
function choose(event: MouseEvent, id: ShapePreset) {
  studio.shapes.choose(id)
  ;(event.currentTarget as HTMLElement).closest('details')?.removeAttribute('open')
}
</script>
<template>
  <details class="studio-picture-menu studio-shape-picker">
    <summary class="studio-command" :aria-label="t('shapes')"><svg width="22" height="22" viewBox="0 0 24 24"><rect x="2" y="2" width="13" height="13" fill="none" stroke="currentColor" /><circle cx="15" cy="15" r="7" fill="var(--studio-bg)" stroke="currentColor" /></svg><span>{{ t('shapes') }} ▾</span></summary>
    <div class="studio-picture-menu__items studio-shape-grid">
      <button v-for="item in items" :key="item.id" :disabled="busy || editing" :title="t(item.label)" @click="choose($event, item.id)">
        <svg width="44" height="32" viewBox="-2 -2 64 44">
          <path :d="shapePath(item.shape, 60, 40)" :fill="item.shape.kind === 'line' ? 'none' : 'var(--studio-accent-soft)'" stroke="currentColor" stroke-width="2" />
          <path v-if="item.shape.startArrow" :d="arrowHeadPath(60, 40, 2, true)" fill="currentColor" />
          <path v-if="item.shape.endArrow" :d="arrowHeadPath(60, 40, 2, false)" fill="currentColor" />
        </svg>
        <span>{{ t(item.label) }}</span>
      </button>
    </div>
  </details>
</template>
