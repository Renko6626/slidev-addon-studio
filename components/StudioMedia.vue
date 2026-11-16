<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useStudioContext } from '../runtime'

const props = withDefaults(defineProps<{
  kind?: 'audio' | 'video'
  src?: string
  poster?: string
  autoplay?: boolean
  controls?: boolean
  loop?: boolean
  muted?: boolean
  volume?: number
  startTime?: number
}>(), { kind: 'video', src: '', poster: '', autoplay: false, controls: true, loop: false, muted: false, volume: 1, startTime: 0 })
const context = useStudioContext()
const media = ref<HTMLMediaElement | null>(null)
const failed = ref(false)
const blocked = ref(false)
const chinese = typeof navigator !== 'undefined' && navigator.language.toLowerCase().startsWith('zh')
const hint = computed(() => failed.value
  ? chinese ? '无法播放。请检查文件路径和编码；视频可转为 MP4（H.264/AAC），音频可转为 MP3 或 WAV。' : 'Cannot play this file. Check its path and codec; try MP4 (H.264/AAC) for video or MP3/WAV for audio.'
  : chinese ? '浏览器阻止了自动播放，请点击播放。' : 'Autoplay was blocked. Click to play.')
function url(value: string) {
  const base = import.meta.env.BASE_URL.replace(/\/$/, '')
  return value.startsWith('/') && !value.startsWith('//') && !(base && value.startsWith(`${base}/`)) ? base + value : value
}
const source = computed(() => url(props.src))
const active = computed(() => context.active.value)
function seek() {
  const player = media.value
  if (!player || player.readyState < 1) return
  const start = Number.isFinite(props.startTime) ? Math.max(0, props.startTime) : 0
  player.currentTime = Number.isFinite(player.duration) ? Math.min(start, player.duration) : start
}
async function play() {
  const player = media.value
  if (!active.value || !player || !props.src) return
  try {
    await player.play()
    if (media.value === player) blocked.value = false
  }
  catch (error) {
    if (!active.value || media.value !== player || (error as Error).name === 'AbortError') return
    if ((error as Error).name === 'NotAllowedError') blocked.value = true
    else failed.value = true
  }
}
function stop() {
  media.value?.pause()
  seek()
}
function ready() { seek() }
function onPlay() {
  if (!active.value) stop()
  else blocked.value = false
}
watch([media, active, source, () => props.kind, () => props.autoplay], () => {
  failed.value = false
  blocked.value = false
  stop()
  if (active.value && props.autoplay) void play()
}, { immediate: true, flush: 'post' })
watch([media, () => props.volume, () => props.muted], () => {
  if (!media.value) return
  media.value.volume = Number.isFinite(props.volume) ? Math.max(0, Math.min(1, props.volume)) : 1
  media.value.muted = props.muted
}, { flush: 'post' })
watch(() => props.startTime, seek)
onBeforeUnmount(() => media.value?.pause())
</script>

<template>
  <div data-studio-component="StudioMedia" class="studio-media" :class="{ 'studio-media--audio': kind === 'audio', 'studio-media--inactive': !active }" @click.stop @keydown.stop @keyup.stop>
    <component :is="kind === 'audio' ? 'audio' : 'video'" :key="kind" ref="media" :src="source || undefined"
      :poster="kind === 'video' ? url(poster) || undefined : undefined" :controls="active && controls" :loop="loop" :muted="muted"
      preload="metadata" playsinline @loadedmetadata="ready" @play="onPlay" @error="failed = true" />
    <span v-if="!src || !active && kind === 'audio'" class="studio-media__placeholder">{{ kind === 'audio' ? (chinese ? '音频' : 'Audio') : (chinese ? '视频' : 'Video') }}</span>
    <div v-if="failed || blocked" class="studio-media__message" :role="failed ? 'alert' : 'status'">
      <span>{{ hint }}</span>
      <button v-if="blocked && active && !failed" type="button" @click="play">{{ chinese ? '播放' : 'Play' }}</button>
    </div>
  </div>
</template>

<style scoped>
.studio-media { box-sizing: border-box; position: relative; width: 480px; height: 270px; background: #111827; color: #f8fafc; border-radius: 8px; overflow: hidden; }
.studio-media video { width: 100%; height: 100%; object-fit: contain; }
.studio-media--audio { height: 100px; display: flex; align-items: center; padding: 12px; background: #e2e8f0; color: #0f172a; }
.studio-media audio { width: 100%; }
.studio-media--inactive audio, .studio-media--inactive video { pointer-events: none; }
.studio-media__placeholder { position: absolute; inset: 0; display: grid; place-items: center; pointer-events: none; font-size: 18px; }
.studio-media__message { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; gap: 12px; padding: 12px; background: #111827e8; color: #fff; font-size: 16px; line-height: 1.4; }
.studio-media__message button { flex-shrink: 0; padding: 6px 12px; border: 1px solid currentColor; border-radius: 6px; }
</style>

<studio lang="yaml">
propsMode: declared
description: 当前播放页的原生音视频，编辑与缩略图保持静止
category: 素材
snippet: '<StudioMedia kind="video" src="" />'
preview: '<StudioMedia kind="video" />'
props:
  kind:
    label: 类型
    options: [audio, video]
  src:
    label: 素材路径
    control: text
  poster:
    label: 视频封面
    control: image
  autoplay:
    label: 进入页面自动播放
  controls:
    label: 显示播放控件
  loop:
    label: 循环
  muted:
    label: 静音
  volume:
    label: 音量（0–1）
  startTime:
    label: 起播时间（秒）
</studio>
