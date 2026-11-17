<script setup lang="ts">
import { useAsyncState } from '@vueuse/core'
import { t } from '../../i18n'

const props = defineProps<{ load: () => Promise<{ default: string }> }>()
const emit = defineEmits<{ copy: [source: string] }>()
const { state: source, isReady, isLoading, error, execute } = useAsyncState(
  async () => (await props.load()).default, '', { immediate: false },
)

function onToggle(event: Event) {
  if ((event.currentTarget as HTMLDetailsElement).open && !isReady.value && !isLoading.value)
    void execute()
}
</script>

<template>
  <details @toggle="onToggle">
    <summary>{{ t('sourceViewVue') }}</summary>
    <p v-if="isLoading" class="studio-hint" role="status">{{ t('sourceLoadingVue') }}</p>
    <p v-else-if="error" role="alert">{{ t('sourceVueFailed') }}</p>
    <template v-else-if="isReady">
      <textarea class="studio-source-code" readonly spellcheck="false" wrap="off" :value="source" :aria-label="t('sourceViewVue')" />
      <button class="studio-button" @click="emit('copy', source)">{{ t('sourceCopyVue') }}</button>
    </template>
  </details>
</template>
