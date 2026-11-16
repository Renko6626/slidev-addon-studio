<script setup lang="ts">
import { action, t } from '../../i18n'
import type { StudioAsset } from '../../types'
import { computed, onMounted, ref } from 'vue'
import { assetApi, readAsBase64 } from '../../composables/useDeckApi'
import { useStudio } from '../../context'
import { assetSnippet, positioned } from '../../md/insert'
import { appendElement } from '../../md/elements'
import { busy, editing, reportError, activePanel, inspectorVisible, library } from '../../state'
import { assetAccept } from '../../../shared/assets'
import { imageLibraryRequest, imagePending, useImageInsertion } from '../../composables/useImageInsertion'

/**
 * The asset drawer, backed by the deck's own `public/` directory. A dropped
 * image becomes a file in the repository and a plain `/name.png` reference in
 * the slide. Nothing here depends on Studio being installed later.
 */
const studio = useStudio()
const images = useImageInsertion()
const importBase = (url: string) => import.meta.env.BASE_URL.replace(/\/$/, '') + url

const assets = ref<StudioAsset[]>([])
const visibleAssets = computed(() => imageLibraryRequest.value ? assets.value.filter(asset => asset.kind === 'image') : assets.value)
const root = ref('')
const over = ref(false)
const uploading = ref(false)

async function refresh() {
  const result = await assetApi.list()
  assets.value = result?.assets ?? []
  root.value = result?.root ?? ''
}

onMounted(refresh)

async function upload(files: FileList | null) {
  if (!files?.length || uploading.value || busy.value || editing.value)
    return
  uploading.value = true
  try {
    for (const file of files) {
      try { await assetApi.upload(file.name, await readAsBase64(file)) }
      catch (error) { reportError(error); break }
    }
    await refresh()
  }
  finally {
    uploading.value = false
  }
}

async function insert(asset: StudioAsset) {
  if (asset.kind === 'image') {
    await images.chooseAsset(asset)
    return
  }
  const page = studio.no()
  const snippet = positioned(assetSnippet(asset), { x: 80, y: 80, w: 480, h: asset.kind === 'audio' ? 100 : 270, rotate: 0 })
  const inserted = appendElement(studio.content(), snippet)
  await studio.commit(inserted.content, action('actionInsert', { name: asset.name }))
  if (studio.no() === page && await studio.selectInserted('StudioMedia', inserted.range)) {
    activePanel.value = 'inspect'
    inspectorVisible.value = true
    library.value = null
  }
}
</script>

<template>
  <label
    v-if="!imageLibraryRequest"
    class="studio-dropzone"
    :class="{ 'studio-dropzone--over': over }"
    @dragover.prevent="over = true"
    @dragleave="over = false"
    @drop.prevent="over = false; upload(($event.dataTransfer as DataTransfer).files)"
  >
    <input type="file" multiple :accept="assetAccept()" :disabled="uploading || busy || editing" hidden @change="upload(($event.target as HTMLInputElement).files); ($event.target as HTMLInputElement).value = ''">
    {{ uploading ? t('uploading') : t('dropAssets') }}
  </label>
  <p v-if="!imageLibraryRequest" class="studio-hint">{{ t('mediaCompatibility') }}</p>
  <p v-if="!imageLibraryRequest" class="studio-hint">{{ t('assetSizeHint') }}</p>

  <div v-if="!visibleAssets.length" class="studio-empty">
    <p>{{ t('noAssets') }}</p>
    <p class="studio-hint">
      {{ t('assetsHint', { root: root || 'public/' }) }}
    </p>
  </div>

  <div v-else class="studio-grid">
    <button
      v-for="asset in visibleAssets"
      :key="asset.url"
      class="studio-asset"
      :title="imageLibraryRequest?.replace ? t('replaceImage') : asset.name"
      :disabled="busy || editing || imagePending || uploading"
      @click="insert(asset)"
    >
      <img v-if="asset.kind === 'image'" :src="importBase(asset.url)" :alt="asset.name" loading="lazy" @error="($event.target as HTMLImageElement).alt = t('imageLoadFailed')">
      <span v-else>{{ t(asset.kind === 'audio' ? 'mediaAudio' : 'mediaVideo') }}</span>
      <span class="studio-asset__name">{{ asset.name }}</span>
    </button>
  </div>
</template>
