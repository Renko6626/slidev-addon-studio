<script setup lang="ts">
import { computed } from 'vue'
import { useInteractionPage } from '../runtime/composables/useInteractionPage'

const props = withDefaults(defineProps<{ question: string, effect?: 'none' | 'fade' | 'pop' }>(), { effect: 'fade' })
const page = useInteractionPage()
const question = computed(() => page.question(props.question))
const result = computed(() => question.value?.state.result ?? 'idle')
const text = computed(() => {
  const configuration = question.value?.configuration
  return result.value === 'correct' ? configuration?.correctText : result.value === 'incorrect' ? configuration?.incorrectText : configuration?.idleText
})
</script>

<template>
  <div class="studio-feedback" :data-studio-question-ref="props.question" :data-quiz-result="result" role="status" aria-live="polite">
    <span data-studio-interaction-text :key="`${result}-${question?.state.attempts ?? 0}`" class="studio-feedback__content" :class="[`studio-feedback__content--${result}`, result !== 'idle' && `studio-feedback__content--${effect}`]">{{ text }}</span>
  </div>
</template>

<style scoped>
.studio-feedback { width: 800px; font-size: 24px; line-height: 1.4; white-space: pre-wrap; overflow-wrap: anywhere; }
.studio-feedback__content { display: inline-block; }
.studio-feedback__content--correct { color: #15803d; }
.studio-feedback__content--incorrect { color: #b91c1c; }
.studio-feedback__content--fade { animation: studio-feedback-fade .2s ease-out; }
.studio-feedback__content--pop { animation: studio-feedback-pop .22s ease-out; }
@keyframes studio-feedback-fade { from { opacity: 0; } to { opacity: 1; } }
@keyframes studio-feedback-pop { from { opacity: 0; transform: scale(.94); } to { opacity: 1; transform: scale(1); } }
@media (prefers-reduced-motion: reduce) { .studio-feedback__content { animation: none; } }
</style>

<studio lang="yaml">
hidden: true
</studio>
