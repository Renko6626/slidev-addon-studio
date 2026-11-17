<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { t } from '../../i18n'
import { fontApi, readAsBase64 } from '../../composables/useDeckApi'
import { applyProjectFontCSS } from '../../fonts'
import type { ProjectFont } from '../../fonts'
import { FONT_ACCEPT, fontFamilyValue } from '../../../shared/fonts'
import StudioIcon from './StudioIcon.vue'
import { selection } from '../../state'

defineProps<{ value: string | null, placeholder: string, disabled: boolean }>()
const emit = defineEmits<{ change: [family: string] }>()
const opened = ref(false), query = ref(''), importing = ref(false), error = ref('')
const project = ref<ProjectFont[]>([])
const file = ref<File | null>(null), family = ref(''), weight = ref(400), faceStyle = ref<'normal' | 'italic'>('normal')
const anchor = ref<HTMLElement | null>(null), position = ref({ left: '0px', top: '0px' })
watch(() => selection.value?.el, () => { opened.value = false })
const local = [
  ['sans-serif', 'sans-serif'], ['serif', 'serif'], ['monospace', 'monospace'],
  ['Arial', 'Arial'], ['Calibri', 'Calibri'], ['Verdana', 'Verdana'], ['Georgia', 'Georgia'], ['Times New Roman', 'Times New Roman'],
  ['Microsoft YaHei', '微软雅黑'], ['SimSun', '宋体'], ['SimHei', '黑体'], ['Noto Sans CJK SC', 'Noto Sans CJK SC'],
].map(([name, label]) => ({ family: name.includes(' ') ? fontFamilyValue(name) : name, label, name }))
const matches = (name: string) => name.toLocaleLowerCase().includes(query.value.trim().toLocaleLowerCase())
const projectMatches = computed(() => project.value.filter(font => matches(font.label)))
const localMatches = computed(() => local.filter(font => matches(font.label + font.name)))

async function toggle() {
  opened.value = !opened.value
  if (!opened.value) return
  const rect = anchor.value!.getBoundingClientRect()
  position.value = { left: `${Math.max(8, Math.min(rect.left, window.innerWidth - 356))}px`, top: `${rect.bottom + 6}px` }
  error.value = ''
  const result = await fontApi.list()
  if (result) project.value = applyProjectFontCSS(result.css)
}
function choose(value: string) { emit('change', value); opened.value = false }
function keepTextFocus(event: MouseEvent) {
  if (event.target instanceof Element && event.target.closest('button')) event.preventDefault()
}
function selectFile(event: Event) {
  file.value = (event.target as HTMLInputElement).files?.[0] ?? null
  if (file.value) family.value = file.value.name.replace(/\.[^.]+$/, '')
  error.value = ''
}
async function importFont() {
  if (!file.value || !family.value.trim() || importing.value) return
  importing.value = true
  error.value = ''
  try {
    const data = await readAsBase64(file.value)
    let face: FontFace
    try {
      face = new FontFace(fontFamilyValue(family.value.trim()), await file.value.arrayBuffer(), { weight: String(weight.value), style: faceStyle.value })
      await face.load()
    }
    catch { throw new Error(t('fontInvalidFile')) }
    const result = await fontApi.upload({ name: file.value.name, data, family: family.value.trim(), weight: weight.value, style: faceStyle.value })
    if (!result) { error.value = t('projectWriteFailed'); return }
    project.value = applyProjectFontCSS(result.css)
    // Reuse the validated face immediately; the dev server's public-file
    // watcher may not yet have observed the newly written file.
    document.fonts.add(face)
    choose(fontFamilyValue(family.value.trim()))
    file.value = null
  }
  catch (cause) { error.value = cause instanceof Error ? cause.message : String(cause) }
  finally { importing.value = false }
}
</script>

<template>
  <div ref="anchor" class="studio-font-picker" @keydown.esc.stop="opened = false">
    <div class="studio-font-picker__input">
      <input type="text" class="studio-font-name" :style="{ fontFamily: value || undefined }" :value="value ?? ''" :placeholder="placeholder" :aria-label="t('fontFamily')" @change="emit('change', ($event.target as HTMLInputElement).value)">
      <button type="button" class="studio-icon-button" :aria-label="t('fontChoose')" :aria-expanded="opened" @click="toggle"><StudioIcon name="down" :size="12" /></button>
    </div>
    <Teleport to="body">
    <fieldset v-if="opened" class="slidev-studio studio-font-picker__menu" :style="position" :disabled="disabled || importing" data-studio-text-controls :aria-label="t('fontChoose')" @mousedown="keepTextFocus" @keydown.esc.stop="opened = false">
      <div class="studio-font-picker__heading"><strong>{{ t('fontChoose') }}</strong><button type="button" class="studio-icon-button" :aria-label="t('close')" @click="opened = false"><StudioIcon name="close" :size="14" /></button></div>
      <input v-model="query" type="search" :placeholder="t('fontSearch')" :aria-label="t('fontSearch')">
      <div class="studio-font-picker__list">
        <h4>{{ t('fontProject') }}</h4>
        <p v-if="!projectMatches.length" class="studio-hint">{{ t('fontProjectEmpty') }}</p>
        <button v-for="font in projectMatches" :key="font.family" type="button" class="studio-font-choice" @click="choose(font.family)"><span>{{ font.label }}<small>{{ font.faces.join(', ') }}</small></span><span class="studio-font-choice__sample" :style="{ fontFamily: font.family }">{{ t('fontSample') }}</span></button>
        <h4>{{ t('fontLocal') }}</h4>
        <p class="studio-hint">{{ t('fontLocalHint') }}</p>
        <button v-for="font in localMatches" :key="font.family" type="button" class="studio-font-choice" @click="choose(font.family)"><span>{{ font.label }}<small v-if="font.name !== font.label">{{ font.name }}</small></span><span class="studio-font-choice__sample" :style="{ fontFamily: font.family }">{{ t('fontSample') }}</span></button>
      </div>
      <details class="studio-font-import">
        <summary>{{ t('fontImport') }}</summary>
        <p class="studio-hint">{{ t('fontImportHint') }}</p>
        <input type="file" :accept="FONT_ACCEPT" :disabled="importing" :aria-label="t('fontFile')" @change="selectFile">
        <label>{{ t('fontFamily') }}<input v-model="family" type="text" :disabled="importing"></label>
        <div class="studio-font-import__face"><label>{{ t('fontWeight') }}<select v-model="weight" :disabled="importing"><option v-for="n in [100,200,300,400,500,600,700,800,900]" :key="n" :value="n">{{ n }}</option></select></label><label>{{ t('fontFaceStyle') }}<select v-model="faceStyle" :disabled="importing"><option value="normal">{{ t('fontNormal') }}</option><option value="italic">{{ t('italic') }}</option></select></label></div>
        <p v-if="error" class="studio-file-error" role="alert">{{ error }}</p>
        <button type="button" class="studio-button" :disabled="!file || !family.trim() || importing" @click="importFont">{{ t(importing ? 'fontImporting' : 'fontImportApply') }}</button>
      </details>
    </fieldset>
    </Teleport>
  </div>
</template>

<style scoped>
.studio-font-picker { position: relative; min-width: 0; }
.studio-font-picker__input { display: flex; align-items: center; gap: 2px; }
.studio-font-picker__input input { min-width: 0; width: 100%; }
.studio-font-picker__menu { position: fixed; z-index: 120; width: 340px; max-width: calc(100vw - 36px); max-height: calc(100vh - 180px); overflow-y: auto; margin: 0; min-width: 0; padding: 12px; background: var(--studio-bg); color: var(--studio-text); border: 1px solid var(--studio-border); border-radius: 6px; box-shadow: var(--studio-shadow); }
.studio-font-picker__heading { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
.studio-font-picker__menu input { width: 100%; min-width: 0; }
.studio-font-picker__menu input[type="search"] { padding: 6px 8px; font: inherit; color: var(--studio-text); background: var(--studio-bg-soft); border: 1px solid var(--studio-border); border-radius: 6px; }
.studio-font-picker__list { max-height: 240px; overflow-y: auto; margin-top: 8px; }
.studio-font-picker__list h4 { margin: 10px 0 4px; font-size: 11px; color: var(--studio-text-dim); }
.studio-font-choice { display: block; width: 100%; text-align: left; padding: 8px; border: 0; border-radius: 4px; background: transparent; color: inherit; cursor: pointer; }
.studio-font-choice:hover, .studio-font-choice:focus-visible { background: var(--studio-bg-hover); }
.studio-font-choice small { margin-left: 8px; color: var(--studio-text-dim); font-size: 10px; }
.studio-font-choice__sample { display: block; margin-top: 5px; font-size: 20px; line-height: 1.5; }
.studio-font-import { margin-top: 10px; padding-top: 10px; border-top: 1px solid var(--studio-border); }
.studio-font-import summary { cursor: pointer; font-weight: 600; }
.studio-font-import label { display: block; margin-top: 8px; font-size: 11px; }
.studio-font-import label input, .studio-font-import select { display: block; width: 100%; margin-top: 4px; }
.studio-font-import__face { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 10px; }
</style>
