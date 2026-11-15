<script setup lang="ts">
import './styles/layers.css'
import { computed, defineAsyncComponent } from 'vue'
import { useNav } from '@slidev/client'
// Keep the authoring UI and rich-text engine out of static presentation bundles.
const StudioRoot = __DEV__ && __SLIDEV_FEATURE_EDITOR__
  ? defineAsyncComponent(() => import('./client/ui/StudioRoot.vue'))
  : undefined

/**
 * Studio only exists while `slidev` is running with the editor enabled. In
 * build, export and print modes this renders nothing, so a published deck
 * carries none of it.
 */
const nav = useNav()

const available = computed(() =>
  __DEV__
  && __SLIDEV_FEATURE_EDITOR__
  && !nav.isPrintMode.value
  && !nav.isEmbedded.value
  && !nav.isNotesViewer.value,
)
</script>

<template>
  <StudioRoot v-if="available" />
</template>
