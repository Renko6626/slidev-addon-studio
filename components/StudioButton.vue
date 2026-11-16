<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { QuizSignal } from '../shared/quiz'
import { useStudioContext } from '../runtime'
import { useInteractionPage } from '../runtime/composables/useInteractionPage'

type Appearance = 'normal' | 'selected' | 'correct' | 'incorrect'
const props = withDefaults(defineProps<{
  question: string
  action: QuizSignal['action']
  option?: string
  contentHtml?: string
  imageSrc?: string
  imageAlt?: string
  fill?: string
  color?: string
  selectedFill?: string
  correctFill?: string
  incorrectFill?: string
  radius?: number
}>(), { contentHtml: '<p>Button</p>', imageSrc: '', imageAlt: '', fill: '#EFF6FF', color: '#1E293B', selectedFill: '#DBEAFE', correctFill: '#DCFCE7', incorrectFill: '#FEE2E2', radius: 10 })
const context = useStudioContext()
const interactionEditing = computed(() => context.runtime.mode.value === 'edit')
const page = useInteractionPage(context)
const root = ref<HTMLElement | null>(null)
const temporary = ref<Appearance | null>(null)
const question = computed(() => page.question(props.question))
const option = computed(() => question.value?.configuration.options.find(option => option.id === props.option))
const optionButton = computed(() => props.action === 'choose' || props.action === 'set-option')
const selected = computed(() => optionButton.value && !!props.option && !!question.value?.state.selected.includes(props.option))
const imageUrl = computed(() => props.imageSrc.startsWith('/') && !props.imageSrc.startsWith('//')
  ? import.meta.env.BASE_URL.replace(/\/$/, '') + props.imageSrc : props.imageSrc)
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
function onKey(event: KeyboardEvent) {
  if (event.target !== event.currentTarget || !['Enter', ' '].includes(event.key)) return
  event.preventDefault()
  event.stopPropagation()
  if (!event.repeat) activate()
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
  <div ref="root" role="button" tabindex="0" data-studio-component="StudioButton" class="studio-quiz-button" :style="style" :data-quiz-appearance="appearance" :data-studio-question-ref="props.question"
    :aria-pressed="optionButton ? selected : undefined" :aria-disabled="!page.active.value"
    @click.stop="activate" @keydown="onKey" @keyup.enter.stop @keyup.space.stop>
    <span v-if="optionButton" class="studio-quiz-button__option" aria-hidden="true">{{ props.option }}</span>
    <img v-show="imageSrc" data-studio-field="imageSrc" class="studio-quiz-button__image" :src="imageUrl || undefined" :alt="imageAlt">
    <div data-studio-field="contentHtml" class="studio-quiz-button__text" v-html="contentHtml" />
  </div>
</template>

<style scoped>
.studio-quiz-button { box-sizing: border-box; display: flex; align-items: center; gap: 12px; width: 280px; height: 56px; padding: 12px 16px; border: 1px solid rgba(100, 116, 139, .3); font-size: 22px; line-height: 1.3; text-align: left; cursor: pointer; white-space: pre-wrap; overflow-wrap: anywhere; }
.studio-quiz-button:focus-visible { outline: 3px solid #2563eb; outline-offset: 3px; }
.studio-quiz-button[aria-disabled="true"] { cursor: default; }
.studio-quiz-button__option { flex-shrink: 0; font-size: 16px; opacity: .7; }
.studio-quiz-button__image { width: 64px; height: 100%; max-height: 96px; object-fit: cover; flex-shrink: 0; border-radius: 6px; }
.studio-quiz-button__text { flex: 1; min-width: 0; }
.studio-quiz-button__text :deep(p) { margin: 0; }
</style>

<studio lang="yaml">
hidden: true
propsMode: declared
props:
  contentHtml:
    label: 内容
    control: richtext
  imageSrc:
    label: 图片
    control: image
  imageAlt:
    label: 图片说明
    control: text
</studio>
