<script setup lang="ts">
import { computed } from 'vue'
import { useQuiz, useStudioContext } from '../../runtime'

const props = withDefaults(defineProps<{
  question?: string
  option?: string
  contentHtml?: string
  imageSrc?: string
  imageAlt?: string
}>(), { question: '', option: 'A', contentHtml: '<p>图文选项</p>', imageSrc: '', imageAlt: '' })
const quiz = useQuiz()
const context = useStudioContext()
const current = computed(() => quiz.question(props.question).value)
const selected = computed(() => current.value?.state.selected.includes(props.option) ?? false)
const appearance = computed(() => {
  if (!selected.value) return 'normal'
  if (!current.value?.state.result) return 'selected'
  return current.value.configuration.options.find(option => option.id === props.option)?.correct ? 'correct' : 'incorrect'
})
const imageUrl = computed(() => props.imageSrc.startsWith('/') && !props.imageSrc.startsWith('//')
  ? import.meta.env.BASE_URL.replace(/\/$/, '') + props.imageSrc : props.imageSrc)

function activate() {
  if (!context.active.value || !current.value) return
  quiz.dispatch(current.value.configuration.mode === 'single'
    ? { question: props.question, action: 'choose', option: props.option }
    : { question: props.question, action: 'set-option', option: props.option, selected: !selected.value })
}
function onKey(event: KeyboardEvent) {
  if (event.target !== event.currentTarget || !['Enter', ' '].includes(event.key)) return
  event.preventDefault()
  event.stopPropagation()
  if (!event.repeat) activate()
}
</script>

<template>
  <div class="editable-option" data-studio-component="EditableOptionCard" :data-studio-question-ref="question"
    :data-quiz-appearance="appearance" role="button" tabindex="0" :aria-pressed="selected" :aria-disabled="!context.active.value"
    @click.stop="activate" @keydown="onKey" @keyup.enter.stop @keyup.space.stop>
    <div class="editable-option__picture">
      <img data-studio-field="imageSrc" :src="imageUrl || undefined" :alt="imageAlt">
      <span v-if="!imageSrc" class="editable-option__placeholder" aria-hidden="true">选择一张图片</span>
    </div>
    <div data-studio-field="contentHtml" class="editable-option__text" v-html="contentHtml" />
  </div>
</template>

<style scoped>
.editable-option { box-sizing: border-box; display: flex; align-items: center; gap: 18px; width: 400px; height: 120px; padding: 14px; border: 2px solid #cbd5e1; border-radius: 14px; background: #f8fafc; color: #1e293b; cursor: pointer; font-size: 22px; }
.editable-option[data-quiz-appearance="selected"] { background: #dbeafe; border-color: #2563eb; }
.editable-option[data-quiz-appearance="correct"] { background: #dcfce7; border-color: #16a34a; }
.editable-option[data-quiz-appearance="incorrect"] { background: #fee2e2; border-color: #dc2626; }
.editable-option:focus-visible { outline: 3px solid #2563eb; outline-offset: 3px; }
.editable-option__picture { position: relative; width: 100px; height: 100%; flex-shrink: 0; background: #e2e8f0; border-radius: 8px; overflow: hidden; }
.editable-option__picture img { display: block; width: 100%; height: 100%; object-fit: cover; }
.editable-option__placeholder { position: absolute; inset: 0; display: grid; place-items: center; padding: 8px; font-size: 14px; text-align: center; pointer-events: none; }
.editable-option__text { flex: 1; min-width: 0; overflow-wrap: anywhere; }
.editable-option__text :deep(p) { margin: 0; }
</style>

<studio lang="yaml">
propsMode: declared
description: 可编辑富文本与图片，使用已有题目动作答题
category: 字段示例
snippet: '<EditableOptionCard question="" option="A" content-html="&lt;p&gt;图文选项&lt;/p&gt;" image-src="" image-alt="" />'
preview: '<EditableOptionCard content-html="&lt;p&gt;图文选项&lt;/p&gt;" />'
props:
  contentHtml:
    label: 选项文字
    control: richtext
  imageSrc:
    label: 选项图片
    control: image
  imageAlt:
    label: 图片说明
    control: text
</studio>
