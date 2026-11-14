<script setup lang="ts">
import { watch } from 'vue'
import { imageLibraryRequest, imagePending } from '../composables/useImageInsertion'
import { t } from '../i18n'
import { activePanel, inspectorVisible, library } from '../state'
import PanelComponents from './panels/PanelComponents.vue'
import PanelAssets from './panels/PanelAssets.vue'
import StudioIcon from './parts/StudioIcon.vue'

watch(library, value => { if (value !== 'assets') imageLibraryRequest.value = null })

function inserted() {
  library.value = null
  activePanel.value = 'inspect'
  inspectorVisible.value = true
}
</script>

<template>
  <section v-if="library" class="studio-library" :aria-label="t(library)" @keydown.esc.stop="library = null">
    <header class="studio-dock__header">
      <strong>{{ imageLibraryRequest ? t(imageLibraryRequest.replace ? 'replaceImage' : 'selectImage') : t(library) }}</strong><span v-if="imagePending" role="status">{{ t('uploading') }}</span>
      <button class="studio-icon-button" :title="t('closeLibrary')" @click="library = null"><StudioIcon name="close" /></button>
    </header>
    <div class="studio-library__body">
      <PanelComponents v-if="library === 'components'" @inserted="inserted" />
      <PanelAssets v-else />
    </div>
  </section>
</template>
