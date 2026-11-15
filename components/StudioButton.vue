<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { QuizSignal } from '../shared/quiz'
import { interactionEditing } from '../runtime/interactions'
import { useInteractionPage } from '../runtime/useInteractionPage'

type Appearance = 'normal' | 'selected' | 'correct' | 'incorrect'
const props = withDefaults(defineProps<{
  question: string
  action: QuizSignal['action']
  option?: string
  label?: string
  fill?: string
  color?: string
  selectedFill?: string
  correctFill?: string
  incorrectFill?: string
  radius?: number
}>(), { fill: '#EFF6FF', color: '#1E293B', selectedFill: '#DBEAFE', correctFill: '#DCFCE7', incorrectFill: '#FEE2E2', radius: 10 })
const page = useInteractionPage()
const root = ref<HTMLButtonElement | null>(null)
const temporary = ref<Appearance | null>(null)
const question = computed(() => page.question(props.question))
const option = computed(() => question.value?.configuration.options.find(option => option.id === props.option))
const optionButton = computed(() => props.action === 'choose' || props.action === 'set-option')
const selected = computed(() => optionButton.value && !!props.option && !!question.value?.state.selected.includes(props.option))
const label = computed(() => props.label ?? (optionButton.value ? option.value?.label : '') ?? '')
const appearance = computed<Appearance>(() => {
  if (interactionEditing.value && temporary.value) return temporary.value
  if (!selected.value) return 'normal'
  return question.value?.state.result ? option.value?.correct ? 'correct' : 'incorrect' : 'selected'
})
const style = computed(() => ({
  backgroundColor: appearance.value === 'selected' ? props.selectedFill : appearance.value === 'correct' ? props.correctFill : appearance.value === 'incorrect' ? props.incorrectFill : props.fill,
  color: props.color,
  borderRadius: `${props.radius}px`,
}))

function activate() {
  let signal: QuizSignal
  if (props.action === 'choose' || props.action === 'set-option') {
    if (!props.option) return
    signal = props.action === 'choose'
      ? { question: props.question, action: 'choose', option: props.option }
      : { question: props.question, action: 'set-option', option: props.option, selected: !selected.value }
  }
  else signal = { question: props.question, action: props.action }
  page.dispatch(signal)
}
function preview(event: Event) {
  const appearance = (event as CustomEvent).detail
  if (interactionEditing.value && ['normal', 'selected', 'correct', 'incorrect'].includes(appearance)) temporary.value = appearance
}
onMounted(() => root.value?.addEventListener('studio-button-preview', preview))
onBeforeUnmount(() => root.value?.removeEventListener('studio-button-preview', preview))
watch(interactionEditing, () => { temporary.value = null }, { flush: 'sync' })
watch(() => [props.question, props.action, props.option], () => { temporary.value = null })
</script>

<template>
  <button ref="root" type="button" class="studio-quiz-button" :style="style" :data-quiz-appearance="appearance" :data-studio-question-ref="props.question"
    :aria-pressed="optionButton ? selected : undefined" :aria-disabled="!page.active.value"
    @click.stop="activate" @keydown.enter.stop @keyup.enter.stop @keydown.space.stop @keyup.space.stop>
    <span data-studio-interaction-text>{{ label }}</span>
  </button>
</template>

<style scoped>
.studio-quiz-button { display: flex; align-items: center; width: 280px; height: 56px; padding: 12px 16px; border: 1px solid rgba(100, 116, 139, .3); font-size: 22px; line-height: 1.3; text-align: left; cursor: pointer; white-space: pre-wrap; overflow-wrap: anywhere; }
.studio-quiz-button:focus-visible { outline: 3px solid #2563eb; outline-offset: 3px; }
.studio-quiz-button[aria-disabled="true"] { cursor: default; }
</style>

<studio lang="yaml">
hidden: true
</studio>
