<script setup lang="ts">
import { computed } from 'vue'
import { useInteractionPage } from '../runtime/useInteractionPage'

const props = defineProps<{ question: string }>()
const page = useInteractionPage()
const title = computed(() => page.question(props.question)?.configuration.title ?? '')
</script>

<template>
  <div class="studio-question-title" :data-studio-question-ref="question">
    <span data-studio-interaction-text>{{ title }}</span>
  </div>
</template>

<style scoped>
.studio-question-title { width: 800px; font-size: 32px; line-height: 1.35; white-space: pre-wrap; overflow-wrap: anywhere; }
</style>

<studio lang="yaml">
hidden: true
</studio>
