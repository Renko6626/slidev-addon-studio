<script setup lang="ts">
import { useQuiz } from '../runtime'

withDefaults(defineProps<{ label?: string, fontSize?: number, color?: string }>(), {
  label: '已答对', fontSize: 24, color: 'inherit',
})
const { correctCount } = useQuiz()
</script>

<template>
  <div class="studio-correct-count" :style="{ fontSize: `${fontSize}px`, color }">{{ label }} {{ correctCount }}</div>
</template>

<style scoped>
.studio-correct-count { width: 240px; min-height: 36px; line-height: 1.4; overflow-wrap: anywhere; }
</style>

<studio lang="yaml">
description: 显示本次试播曾答对的题目数
category: 答题
snippet: '<StudioCorrectCount v-drag="[40,40,240,48]" />'
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
