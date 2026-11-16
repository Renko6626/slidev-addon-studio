<script setup lang="ts">
import { computed, onScopeDispose, watch } from 'vue'
import type { QuestionPresentation, QuizMode, QuizOption } from '../shared/quiz'
import { useStudioContext } from '../runtime'
import { useInteractionPage } from '../runtime/composables/useInteractionPage'

const props = withDefaults(defineProps<{
  question: string
  mode?: QuizMode
  name?: string
  presentation?: QuestionPresentation
  options?: QuizOption[]
}>(), { mode: 'single', name: '', presentation: 'hidden', options: () => [] })
const context = useStudioContext()
const interactionEditing = computed(() => context.runtime.mode.value === 'edit')
const page = useInteractionPage(context)
let unregister = () => {}
// Slidev can pass equal new arrays when its page rerenders; those are the same question.
function configuration() {
  return { mode: props.mode, options: props.options }
}
watch(() => JSON.stringify({ question: props.question, ...configuration() }), () => {
  unregister()
  unregister = page.registerQuestion(props.question, configuration())
}, { immediate: true })
onScopeDispose(() => unregister())
</script>

<template>
  <div v-show="presentation === 'summary' || interactionEditing" class="studio-question" :data-studio-question-control="question">
    <span v-if="interactionEditing" class="studio-question__icon" aria-hidden="true">?</span>
    <span class="studio-question__name">{{ name || question }}</span>
  </div>
</template>

<style scoped>
.studio-question { display: flex; align-items: center; gap: 8px; width: 220px; min-height: 32px; padding: 5px 10px; border: 1px dashed #64748b; border-radius: 6px; background: #f1f5f9; color: #334155; font-size: 14px; line-height: 1.4; white-space: nowrap; }
.studio-question__icon { display: grid; place-items: center; width: 18px; height: 18px; flex-shrink: 0; border: 1px solid currentColor; border-radius: 50%; font-weight: 600; font-size: 12px; }
.studio-question__name { overflow: hidden; text-overflow: ellipsis; }
</style>

<studio lang="yaml">
hidden: true
</studio>
