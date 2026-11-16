<script setup lang="ts">
import { computed } from 'vue'
import { useStudioContext } from 'slidev-addon-studio/runtime'

const props = withDefaults(defineProps<{
  contentHtml?: string
  imageSrc?: string
  imageAlt?: string
  accent?: string
}>(), { contentHtml: '<p>嘉宾姓名</p><p>在这里介绍这位嘉宾。</p>', imageSrc: '', imageAlt: '嘉宾头像', accent: '#38bdf8' })
const context = useStudioContext()
const imageUrl = computed(() => props.imageSrc.startsWith('/') && !props.imageSrc.startsWith('//')
  ? import.meta.env.BASE_URL.replace(/\/$/, '') + props.imageSrc : props.imageSrc)
</script>

<template>
  <div data-studio-component="GuestSpotlight" class="guest-spotlight" :class="{ 'guest-spotlight--playing': context.active.value }" :style="{ '--guest-accent': accent }">
    <div class="guest-spotlight__glow" aria-hidden="true" />
    <div class="guest-spotlight__portrait">
      <img data-studio-field="imageSrc" :src="imageUrl || undefined" :alt="imageAlt">
      <span v-if="!imageSrc" aria-hidden="true">替换嘉宾图片</span>
    </div>
    <div data-studio-field="contentHtml" class="guest-spotlight__content" v-html="contentHtml" />
  </div>
</template>

<style scoped>
.guest-spotlight { box-sizing: border-box; position: relative; isolation: isolate; display: flex; align-items: center; gap: 28px; width: 760px; height: 240px; padding: 28px; border: 1px solid var(--guest-accent); border-radius: 24px; background: #0f172a; color: #f8fafc; overflow: hidden; }
.guest-spotlight__glow { position: absolute; inset: -100%; z-index: -1; pointer-events: none; background: conic-gradient(from 0deg, transparent 60%, var(--guest-accent), transparent); opacity: .16; }
.guest-spotlight--playing .guest-spotlight__glow { animation: guest-orbit 12s linear infinite; }
.guest-spotlight__portrait { position: relative; flex: 0 0 28%; height: 100%; min-width: 0; border-radius: 14px; overflow: hidden; background: #334155; }
.guest-spotlight__portrait img { width: 100%; height: 100%; object-fit: cover; }
.guest-spotlight__portrait span { position: absolute; inset: 0; display: grid; place-items: center; padding: 12px; font-size: 16px; pointer-events: none; }
.guest-spotlight__content { flex: 1; min-width: 0; font-size: 24px; line-height: 1.5; overflow-wrap: anywhere; }
.guest-spotlight__content :deep(p) { margin: 0 0 10px; }
@keyframes guest-orbit { to { transform: rotate(360deg); } }
@media (prefers-reduced-motion: reduce) { .guest-spotlight--playing .guest-spotlight__glow { animation: none; } }
</style>

<studio lang="yaml">
propsMode: declared
description: 整体拖动的嘉宾卡，文字、头像和主色可继续编辑
category: 活动
snippet: '<GuestSpotlight content-html="&lt;p&gt;嘉宾姓名&lt;/p&gt;&lt;p&gt;在这里介绍这位嘉宾。&lt;/p&gt;" image-src="" />'
preview: '<GuestSpotlight />'
props:
  contentHtml:
    label: 嘉宾介绍
    control: richtext
  imageSrc:
    label: 嘉宾头像
    control: image
  imageAlt:
    label: 图片说明
    control: text
  accent:
    label: 主色
    control: color
</studio>
