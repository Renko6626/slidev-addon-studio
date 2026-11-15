<script setup lang="ts">
import { useQuiz, useStudioContext } from '../../runtime'

withDefaults(defineProps<{ label?: string, fontSize?: number, color?: string }>(), {
  label: '本次练习', fontSize: 24, color: '#2563EB',
})
const { correctCount } = useQuiz()
const { runtime, active } = useStudioContext()

function restart() {
  if (active.value) runtime.resetTrial()
}
</script>

<template>
  <section class="quiz-progress" :style="{ fontSize: `${fontSize}px`, color }">
    <span>{{ label }}：已答对 {{ correctCount }} 题</span>
    <button type="button" :disabled="!active" @click.stop="restart" @keydown.stop>重新试播</button>
  </section>
</template>

<style scoped>
.quiz-progress { box-sizing: border-box; width: 360px; min-height: 64px; display: flex; align-items: center; gap: 16px; flex-wrap: wrap; padding: 10px 14px; border: 1px solid currentColor; border-radius: 12px; overflow-wrap: anywhere; }
button { font-size: 14px; border: 1px solid currentColor; border-radius: 6px; padding: 4px 8px; background: transparent; color: inherit; cursor: pointer; }
button:disabled { opacity: .45; cursor: default; }
</style>

<studio lang="yaml">
description: 复用内置题目计数，并重置本次试播
category: 答题示例
snippet: '<QuizProgress label="本次练习" :font-size="24" />'
props:
  label:
    label: 标签
  fontSize:
    label: 字号
    control: number
  color:
    label: 颜色
    control: color
</studio>
