<script setup lang="ts">
import { onScopeDispose, watch } from 'vue'
import type { QuizMode, QuizOption } from '../shared/quiz'
import { useInteractionPage } from '../runtime/useInteractionPage'

const props = withDefaults(defineProps<{
  question: string
  mode?: QuizMode
  title?: string
  options?: QuizOption[]
  correctText?: string
  incorrectText?: string
  idleText?: string
}>(), { mode: 'single', title: '', options: () => [], correctText: 'Correct!', incorrectText: 'Try again.', idleText: '' })
const page = useInteractionPage()
let unregister = () => {}
// Slidev can pass equal new arrays when its page rerenders; those are the same question.
function configuration() {
  return { mode: props.mode, options: props.options, correctText: props.correctText, incorrectText: props.incorrectText, idleText: props.idleText }
}
watch(() => JSON.stringify({ question: props.question, ...configuration() }), () => {
  unregister()
  unregister = page.registerQuestion(props.question, configuration())
}, { immediate: true })
onScopeDispose(() => unregister())
</script>

<template>
  <div class="studio-question" :data-studio-question="question">
    <span data-studio-interaction-text>{{ title }}</span>
  </div>
</template>

<style scoped>
.studio-question { width: 800px; font-size: 32px; line-height: 1.35; white-space: pre-wrap; overflow-wrap: anywhere; }
</style>

<studio lang="yaml">
hidden: true
</studio>
