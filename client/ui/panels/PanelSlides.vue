<script setup lang="ts">
import { t } from '../../i18n'
import { useNav } from '@slidev/client'
import { useLocalStorage } from '@vueuse/core'
import { computed, nextTick, ref, watch } from 'vue'
import { useElementSize } from '@vueuse/core'
import { useDeckActions } from '../../composables/useDeckActions'
import { onDomEvent } from '../../composables/useDomEvent'
import { busy, editing } from '../../state'
import { useStudio } from '../../context'
import SlideThumbnail from '../parts/SlideThumbnail.vue'
import StudioIcon from '../parts/StudioIcon.vue'

const studio = useStudio()
const nav = useNav()
const { add, duplicate, remove, move } = useDeckActions()
const slides = computed(() => nav.slides.value)
const showThumbnails = useLocalStorage('slidev-studio:slide-thumbnails', true)
const list = ref<HTMLElement | null>(null)
const { width } = useElementSize(list)
const thumbnailWidth = computed(() => Math.max(80, width.value - 48))

function titleOf(slide: (typeof nav.slides.value)[number]) {
  const plain = slide.meta.slide.title?.replace(/<[^>]*>/g, '').trim()
  return plain || slide.meta.slide.frontmatter.layout || t('untitled')
}

watch(() => studio.no(), async () => {
  await nextTick()
  list.value?.querySelector('[aria-current="true"]')?.scrollIntoView({ block: 'nearest' })
}, { immediate: true })

function go(no: number) {
  if (!editing.value && !busy.value)
    nav.go(no)
}

/*
 * Dragging a slide is the natural way to reorder one, and clicking an arrow
 * eleven times is not. The drop target is tracked per row so the list shows
 * where the slide will land.
 */
const dragging = ref<number | null>(null)
const over = ref<number | null>(null)

function onDragStart(no: number) {
  dragging.value = no
}

function onDragOver(no: number) {
  if (dragging.value !== null && dragging.value !== no)
    over.value = no
}

async function onDrop(no: number) {
  const from = dragging.value
  dragging.value = null
  over.value = null
  if (from === null || from === no)
    return
  await move(from, no)
}

onDomEvent(window, 'dragend', () => {
  dragging.value = null
  over.value = null
})
</script>

<template>
  <div class="studio-filmstrip">
    <div class="studio-filmstrip__heading">
      <strong>{{ t('slides') }}</strong>
      <button class="studio-icon-button" :aria-pressed="showThumbnails" :title="t('showThumbnails')" @click="showThumbnails = !showThumbnails">
        <StudioIcon :name="showThumbnails ? 'slides' : 'flow'" />
      </button>
    </div>
    <div ref="list" class="studio-filmstrip__list" :aria-label="t('slides')">
      <div
        v-for="slide in slides" :key="slide.no" class="studio-slide-item"
        :class="{ 'is-current': slide.no === studio.no(), 'is-over': over === slide.no, 'is-dragging': dragging === slide.no }"
        @dragover.prevent="onDragOver(slide.no)" @drop.prevent="onDrop(slide.no)"
      >
        <span class="studio-slide-item__no">{{ slide.no }}</span>
        <button
          class="studio-slide-item__preview" :aria-current="slide.no === studio.no()"
          :aria-label="`${slide.no}: ${titleOf(slide)}`" :disabled="editing || busy"
          :draggable="!editing && !busy && slide.no !== 1" @click="go(slide.no)" @dragstart="onDragStart(slide.no)"
          @keydown.down.prevent="go(Math.min(slide.no + 1, slides.length))"
          @keydown.up.prevent="go(Math.max(1, slide.no - 1))"
        >
          <SlideThumbnail v-if="showThumbnails" :route="slide" :width="thumbnailWidth" />
          <span class="studio-slide-item__title">{{ titleOf(slide) }}</span>
        </button>
        <span class="studio-slide-item__actions">
          <button class="studio-icon-button" :title="t('duplicateSlide')" :disabled="busy || editing" @click="duplicate(slide.no)"><StudioIcon name="copy" :size="14" /></button>
          <button class="studio-icon-button" :title="slide.no === 1 ? t('firstSlideProtected') : t('deleteSlide')" :disabled="busy || editing || slide.no === 1" @click="remove(slide.no)"><StudioIcon name="trash" :size="14" /></button>
        </span>
      </div>
    </div>
    <div class="studio-filmstrip__footer">
      <button class="studio-button" :disabled="busy || editing" @click="add(studio.no())"><StudioIcon name="plus" />{{ t('newSlide') }}</button>
      <p class="studio-hint">{{ t('deckReloadHint') }}</p>
    </div>
  </div>
</template>
