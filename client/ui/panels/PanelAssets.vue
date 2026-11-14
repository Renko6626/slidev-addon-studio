<script setup lang="ts">
import { action, t } from '../../i18n'
import type { StudioAsset } from '../../types'
import { computed, onMounted, ref } from 'vue'
import { assetApi, readAsBase64 } from '../../composables/useDeckApi'
import { useStudio } from '../../context'
import { assetSnippet, insertSnippet, positioned } from '../../md/insert'
import { busy, editing, selection } from '../../state'
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
  if (!files?.length)
    return
  uploading.value = true
  try {
    for (const file of files)
      await assetApi.upload(file.name, await readAsBase64(file))
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
  const range = selection.value?.range
  await studio.commit(
    insertSnippet(studio.content(), assetSnippet(asset), range ? { mode: 'after', range } : { mode: 'append' }),
    action('actionInsert', { name: asset.name }),
  )
}

async function place(asset: StudioAsset) {
  const snippet = positioned(assetSnippet(asset), { x: 80, y: 80, w: 320, h: null, rotate: 0 })
  await studio.commit(insertSnippet(studio.content(), snippet, { mode: 'append' }), action('actionPlace', { name: asset.name }))
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
    <input type="file" multiple accept="image/*,video/*" hidden @change="upload(($event.target as HTMLInputElement).files)">
    {{ uploading ? t('uploading') : t('dropAssets') }}
  </label>

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
      :title="imageLibraryRequest?.replace ? t('replaceImage') : t('picture')"
      :disabled="busy || editing || imagePending"
      @click="asset.kind === 'video' && $event.shiftKey ? place(asset) : insert(asset)"
    >
      <img v-if="asset.kind === 'image'" :src="importBase(asset.url)" :alt="asset.name" loading="lazy">
      <span class="studio-asset__name">{{ asset.name }}</span>
    </button>
  </div>
</template>
