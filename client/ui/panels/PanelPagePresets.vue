<script setup lang="ts">
import { computed } from 'vue'
import { useStudio } from '../../context'
import { useDeckActions } from '../../composables/useDeckActions'
import { useDeckPaint } from '../../composables/useDeckPaint'
import { t } from '../../i18n'
import { busy, editing } from '../../state'
import { imagePending } from '../../composables/useImageInsertion'
import { createPresetPage, PAGE_PRESETS, pagePresetElements } from '../../page-presets'
import type { PagePreset } from '../../page-presets'

const emit = defineEmits<{ inserted: [] }>()
const studio = useStudio()
const deck = useDeckActions()
const paint = useDeckPaint()
const canvas = computed(() => ({ width: studio.canvas.slideWidth.value, height: studio.canvas.slideHeight.value }))
const previews = computed(() => PAGE_PRESETS.map(preset => ({ preset, elements: pagePresetElements(preset, canvas.value, t) })))

async function insert(preset: PagePreset) {
  if (busy.value || editing.value || imagePending.value) return
  const page = createPresetPage(preset, canvas.value, t)
  if (await deck.add(studio.no(), page.content, page.frontmatter)) emit('inserted')
}
</script>

<template>
  <p class="studio-preset-intro">{{ t('pagePresetsHint') }}</p>
  <div class="studio-preset-grid">
    <button v-for="{ preset, elements } in previews" :key="preset.id" class="studio-preset-card" :disabled="busy || editing || imagePending" @click="insert(preset)">
      <svg class="studio-preset-preview" :viewBox="`0 0 ${canvas.width} ${canvas.height}`" :style="paint" aria-hidden="true">
        <template v-for="(box, index) in elements" :key="index">
          <image v-if="box.kind === 'image'" :href="box.src" :x="box.x" :y="box.y" :width="box.w" :height="box.h" preserveAspectRatio="xMidYMid slice" />
          <foreignObject v-else :x="box.x" :y="box.y" :width="box.w" :height="box.h">
            <div xmlns="http://www.w3.org/1999/xhtml" :style="{ fontSize: `${box.font}px`, textAlign: box.align, lineHeight: 1.3, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', margin: 0, padding: 0 }">{{ box.text }}</div>
          </foreignObject>
        </template>
      </svg>
      <span>{{ t(preset.label) }}</span>
    </button>
  </div>
  <p class="studio-preset-intro">{{ t('pagePresetsEditHint') }}</p>
</template>
