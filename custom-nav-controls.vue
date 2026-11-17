<script setup lang="ts">
import { t } from './client/i18n'
import { computed } from 'vue'
import { useNav } from '@slidev/client'
import { studioOpen } from './client/state'
import studioIcon from './client/assets/studio-16.svg'

const nav = useNav()
const available = computed(() => __DEV__ && __SLIDEV_FEATURE_EDITOR__ && !nav.isPrintMode.value)
</script>

<template>
  <button
    v-if="available"
    class="slidev-icon-btn studio-launch"
    :aria-pressed="studioOpen"
    :aria-label="t('toggleStudio')"
    :title="t('toggleStudio')"
    @click="studioOpen = !studioOpen"
  >
    <img :src="studioIcon" width="18" height="18" alt="">
  </button>
</template>

<style scoped>
.studio-launch[aria-pressed="true"] { background-color: rgba(79, 140, 255, .16); }
</style>
