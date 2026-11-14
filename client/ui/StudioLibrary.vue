<script setup lang="ts">
import { t } from '../i18n'
import { activePanel, inspectorVisible, library } from '../state'
import PanelComponents from './panels/PanelComponents.vue'
import PanelAssets from './panels/PanelAssets.vue'
import StudioIcon from './parts/StudioIcon.vue'

function inserted() {
  library.value = null
  activePanel.value = 'inspect'
  inspectorVisible.value = true
}
</script>

<template>
  <section v-if="library" class="studio-library" :aria-label="t(library)" @keydown.esc.stop="library = null">
    <header class="studio-dock__header">
      <strong>{{ t(library) }}</strong>
      <button class="studio-icon-button" :title="t('closeLibrary')" @click="library = null"><StudioIcon name="close" /></button>
    </header>
    <div class="studio-library__body">
      <PanelComponents v-if="library === 'components'" @inserted="inserted" />
      <PanelAssets v-else />
    </div>
  </section>
</template>
