<script setup lang="ts">
import { t } from '../i18n'
import { computed, ref } from 'vue'
import { onDomEvent } from '../composables/useDomEvent'
import { activePanel, dockWidth, inspectorVisible, missed, selection } from '../state'
import PanelAnimate from './panels/PanelAnimate.vue'
import PanelInspect from './panels/PanelInspect.vue'
import PanelLayout from './panels/PanelLayout.vue'
import PanelTransition from './panels/PanelTransition.vue'
import StudioIcon from './parts/StudioIcon.vue'

const panels = {
  inspect: { title: 'element', component: PanelInspect },
  animate: { title: 'animation', component: PanelAnimate },
  layout: { title: 'pageSettings', component: PanelLayout },
  transition: { title: 'slideTransition', component: PanelTransition },
} as const
const currentId = computed(() => activePanel.value === 'inspect' && !selection.value && !missed.value ? 'layout' : activePanel.value)
const current = computed(() => panels[currentId.value])
const resizing = ref(false)
onDomEvent<PointerEvent>(window, 'pointermove', event => {
  if (resizing.value)
    dockWidth.value = Math.min(440, Math.max(260, window.innerWidth - event.clientX))
})
onDomEvent(window, 'pointerup', () => (resizing.value = false))
</script>

<template>
  <aside class="studio-dock" :style="{ width: `${dockWidth}px` }">
    <div class="studio-dock__resizer" :title="t('resizeDock')" @pointerdown.prevent="resizing = true" />
    <header class="studio-dock__header">
      <strong>{{ t(current.title) }}</strong>
      <button class="studio-icon-button" :title="t('hideInspector')" @click="inspectorVisible = false"><StudioIcon name="close" /></button>
    </header>
    <nav class="studio-inspector-tabs" :aria-label="t('properties')">
      <button :disabled="!selection && !missed" :aria-pressed="currentId === 'inspect'" @click="activePanel = 'inspect'">{{ t('objectProperties') }}</button>
      <button :aria-pressed="currentId === 'layout'" @click="activePanel = 'layout'">{{ t('pageSettings') }}</button>
      <button :aria-pressed="currentId === 'animate'" @click="activePanel = 'animate'">{{ t('animate') }}</button>
    </nav>
    <div class="studio-dock__body"><component :is="current.component" /></div>
  </aside>
</template>
