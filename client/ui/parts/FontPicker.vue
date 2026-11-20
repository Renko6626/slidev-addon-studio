<script setup lang="ts">
import { computed, nextTick, ref, useId, watch } from 'vue'
import { onClickOutside } from '@vueuse/core'
import { t } from '../../i18n'
import { fontApi, readAsBase64 } from '../../composables/useDeckApi'
import { applyProjectFontCSS, commonFonts, genericFonts, readSystemFonts } from '../../fonts'
import type { FontChoice, ProjectFont } from '../../fonts'
import { FONT_ACCEPT, fontFamilyValue } from '../../../shared/fonts'
import StudioIcon from './StudioIcon.vue'
import { selection } from '../../state'

const props = defineProps<{ value: string | null, placeholder: string, disabled: boolean }>()
const emit = defineEmits<{ change: [family: string] }>()
const opened = ref(false), query = ref(''), importing = ref(false), error = ref('')
const project = ref<ProjectFont[]>([])
const file = ref<File | null>(null), family = ref(''), weight = ref(400), faceStyle = ref<'normal' | 'italic'>('normal')
const anchor = ref<HTMLButtonElement | null>(null), menu = ref<HTMLFieldSetElement | null>(null)
const searchInput = ref<HTMLInputElement | null>(null)
const fileInput = ref<HTMLInputElement | null>(null)
const familyInput = ref<HTMLInputElement | null>(null)
const list = ref<HTMLElement | null>(null)
const menuId = useId()
const position = ref({ left: '0px', top: '0px', maxHeight: '360px' })
let previousFocus: HTMLElement | null = null
const installed = ref<FontChoice[]>([])
const discovery = ref<'loading' | 'ready' | 'unavailable'>('loading')
watch(() => selection.value?.el, () => { opened.value = false })
onClickOutside(menu, () => { opened.value = false }, { ignore: [anchor] })

const term = computed(() => query.value.trim().toLowerCase())
const groups = computed(() => [
  { label: t('fontProject'), options: project.value.filter(font => font.label.toLowerCase().includes(term.value)) },
  { label: t(discovery.value === 'ready' ? 'fontInstalled' : 'fontLocal'),
    options: (discovery.value === 'ready' ? installed.value : commonFonts).filter(font => font.search.includes(term.value)) },
  { label: t('fontGeneric'), options: genericFonts.filter(font => font.search.includes(term.value)) },
].filter(group => group.options.length))

function familyName(value: string) { return value.replace(/^(["'])(.*)\1$/, '$2') }
const currentName = computed(() => familyName(props.value?.split(',')[0].trim() || ''))
const customName = computed(() => term.value && !groups.value.some(group =>
  group.options.some(font => [font.label, familyName(font.family)].some(name => name.toLowerCase() === term.value))))
function isSelected(family: string) {
  return currentName.value.toLowerCase() === familyName(family).toLowerCase()
}

function positionMenu() {
  const rect = anchor.value!.getBoundingClientRect()
  position.value = {
    left: `${Math.max(4, Math.min(rect.left, window.innerWidth - 300))}px`,
    top: `${rect.bottom + 2}px`,
    maxHeight: `${Math.max(0, window.innerHeight - rect.bottom - 8)}px`,
  }
}
function toggle() {
  if (props.disabled || importing.value) return
  if (!opened.value) {
    previousFocus = document.activeElement instanceof HTMLElement && document.activeElement !== document.body ? document.activeElement : anchor.value
    query.value = ''
    file.value = null
    family.value = ''
    weight.value = 400
    faceStyle.value = 'normal'
    error.value = ''
  }
  opened.value = !opened.value
}
watch(opened, (open, _, onCleanup) => {
  if (!open) return
  positionMenu()
  window.addEventListener('resize', positionMenu)
  let current = true
  onCleanup(() => {
    current = false
    window.removeEventListener('resize', positionMenu)
  })
  discovery.value = 'loading'
  void readSystemFonts().then(fonts => {
    if (!current) return
    installed.value = fonts ?? []
    discovery.value = fonts?.length ? 'ready' : 'unavailable'
  }).catch(() => {
    if (current) discovery.value = 'unavailable'
  })
  void fontApi.list().then(async result => {
    if (!current) return
    if (result) project.value = applyProjectFontCSS(result.css)
    await nextTick()
    if (current && !menu.value?.contains(document.activeElement)) searchInput.value?.focus()
  })
}, { flush: 'sync' })

function choose(value: string) {
  if (props.disabled || !value.trim()) return
  dismiss()
  emit('change', value.trim())
}
function applySearch(event: KeyboardEvent) {
  if (event.isComposing || !query.value.trim()) return
  event.preventDefault()
  choose(groups.value[0]?.options[0]?.family ?? query.value)
}
function navigate(event: KeyboardEvent) {
  if (event.isComposing || !['ArrowDown', 'ArrowUp'].includes(event.key)) return
  const options = Array.from(list.value?.querySelectorAll<HTMLButtonElement>('button') ?? [])
  if (!options.length) return
  event.preventDefault()
  event.stopPropagation()
  const index = options.indexOf(document.activeElement as HTMLButtonElement)
  const next = event.key === 'ArrowDown' ? Math.min(index + 1, options.length - 1) : index - 1
  if (next < 0) searchInput.value?.focus()
  else options[next].focus()
}
async function backToList() {
  file.value = null
  error.value = ''
  await nextTick()
  searchInput.value?.focus()
}
function dismiss() {
  opened.value = false
  const target = previousFocus?.isConnected ? previousFocus : anchor.value
  target?.focus({ preventScroll: true })
}
async function selectFile(event: Event) {
  const input = event.target as HTMLInputElement
  const selected = input.files?.[0]
  if (!selected) return
  file.value = selected
  input.value = ''
  family.value = selected.name.replace(/\.[^.]+$/, '')
  weight.value = 400
  faceStyle.value = 'normal'
  error.value = ''
  await nextTick()
  familyInput.value?.focus()
}
const validWeight = computed(() => Number.isInteger(weight.value) && weight.value >= 1 && weight.value <= 1000)
function adjustWeight(step: number) {
  const current = validWeight.value ? weight.value : 400
  const next = step > 0 ? Math.floor(current / 100) + 1 : Math.ceil(current / 100) - 1
  weight.value = Math.min(1000, Math.max(1, next * 100))
}
async function importFont() {
  if (!file.value || !family.value.trim() || !validWeight.value || importing.value) return
  const target = selection.value?.el
  const chosenFamily = family.value.trim()
  importing.value = true
  error.value = ''
  try {
    const data = await readAsBase64(file.value)
    let face: FontFace
    try {
      face = new FontFace(fontFamilyValue(chosenFamily), await file.value.arrayBuffer(), { weight: String(weight.value), style: faceStyle.value })
      await face.load()
    }
    catch { throw new Error(t('fontInvalidFile')) }
    const result = await fontApi.upload({ name: file.value.name, data, family: chosenFamily, weight: weight.value, style: faceStyle.value })
    if (!result) { error.value = t('projectWriteFailed'); return }
    project.value = applyProjectFontCSS(result.css)
    // Reuse the validated face immediately; the dev server's public-file
    // watcher may not yet have observed the newly written file.
    document.fonts.add(face)
    await nextTick()
    if (opened.value && selection.value?.el === target) choose(fontFamilyValue(chosenFamily))
    file.value = null
  }
  catch (cause) { error.value = cause instanceof Error ? cause.message : String(cause) }
  finally { importing.value = false }
}
</script>

<template>
  <div class="studio-font-picker">
    <button ref="anchor" type="button" class="studio-font-trigger" :disabled="disabled || importing"
      :aria-label="t('fontChoose')" :title="value || t('fontChoose')" :aria-expanded="opened" :aria-controls="opened ? menuId : undefined"
      @click="toggle" @keydown.down.prevent="!opened && toggle()" @keydown.esc.stop="dismiss">
      <span>{{ currentName || placeholder }}</span><StudioIcon name="chevron-down" :size="13" />
    </button>
    <Teleport to="body">
      <fieldset v-if="opened" :id="menuId" ref="menu" class="slidev-studio studio-font-menu" :style="position"
        :disabled="disabled || importing" data-studio-text-controls :aria-label="t('fontChoose')" @keydown.esc.stop.prevent="dismiss">
        <input ref="fileInput" type="file" hidden :accept="FONT_ACCEPT" :aria-label="t('fontFile')" @change="selectFile">
        <template v-if="!file">
          <label class="font-search">
            <StudioIcon name="search" :size="15" />
            <input ref="searchInput" v-model="query" type="search" :placeholder="t('fontSearch')" :aria-label="t('fontSearch')"
              @keydown="navigate" @keydown.enter="applySearch">
          </label>
          <div ref="list" class="font-list font-scroll" @keydown="navigate">
            <section v-for="group in groups" :key="group.label">
              <h4>{{ group.label }}</h4>
              <button v-for="font in group.options" :key="font.family" type="button" class="studio-font-choice" tabindex="-1"
                :aria-pressed="isSelected(font.family)" @click="choose(font.family)">
                <span :style="{ fontFamily: font.family + ', system-ui, sans-serif' }">{{ font.label }}</span>
                <StudioIcon v-if="isSelected(font.family)" name="check" :size="15" />
              </button>
            </section>
            <button v-if="customName" type="button" class="font-custom" @click="choose(query)">{{ t('fontUseName', { name: query.trim() }) }}</button>
            <p v-if="discovery === 'loading'" class="font-status" role="status">{{ t('fontLoading') }}</p>
          </div>
          <div class="font-footer">
            <button type="button" class="font-import-action" @click="fileInput?.click()">
              <StudioIcon name="plus" :size="15" />{{ t('fontImport') }}
            </button>
          </div>
        </template>
        <form v-else class="font-import-form font-scroll" @submit.prevent="importFont">
          <header>
            <button type="button" class="font-back" :aria-label="t('fontChoose')" @click="backToList"><StudioIcon name="back" :size="16" /></button>
            <strong>{{ t('fontImport') }}</strong>
          </header>
          <button class="font-file" type="button" :title="t('fontChangeFile')" @click="fileInput?.click()">
            <StudioIcon name="file" :size="15" /><span>{{ file.name }}</span><StudioIcon name="folder" :size="14" />
          </button>
          <label class="font-field">{{ t('fontFamily') }}<input ref="familyInput" v-model="family" type="text" required autocomplete="off"></label>
          <div class="font-face">
            <div class="font-field">
              <label :for="menuId + '-weight'">{{ t('fontWeight') }}</label>
              <div class="font-weight">
                <button type="button" :aria-label="t('fontLighter')" :title="t('fontLighter')" :disabled="weight <= 1" @click="adjustWeight(-1)"><StudioIcon name="minus" :size="12" /></button>
                <input :id="menuId + '-weight'" v-model.number="weight" type="number" min="1" max="1000" required>
                <button type="button" :aria-label="t('fontHeavier')" :title="t('fontHeavier')" :disabled="weight >= 1000" @click="adjustWeight(1)"><StudioIcon name="plus" :size="12" /></button>
              </div>
            </div>
            <div class="font-field">
              <span>{{ t('fontFaceStyle') }}</span>
              <div class="font-styles" role="group" :aria-label="t('fontFaceStyle')">
                <button type="button" :aria-pressed="faceStyle === 'normal'" @click="faceStyle = 'normal'">{{ t('fontNormal') }}</button>
                <button type="button" :aria-pressed="faceStyle === 'italic'" @click="faceStyle = 'italic'"><i>{{ t('fontItalic') }}</i></button>
              </div>
            </div>
          </div>
          <p v-if="error" class="studio-file-error" role="alert">{{ error }}</p>
          <button type="submit" class="font-apply" :disabled="!family.trim() || !validWeight || importing">{{ t(importing ? 'fontImporting' : 'fontImportApply') }}</button>
        </form>
      </fieldset>
    </Teleport>
  </div>
</template>

<style scoped>
.studio-font-picker { min-width: 0; }
.studio-font-trigger, .studio-font-menu button { appearance: none; font: inherit; cursor: pointer; }
.studio-font-trigger { display: flex; align-items: center; justify-content: space-between; gap: 6px; width: 100%; min-width: 0; height: 28px; padding: 0 8px; color: var(--studio-text); background: var(--studio-bg-soft); border: 1px solid var(--studio-border); border-radius: 4px; text-align: left; }
.studio-font-trigger:hover, .studio-font-trigger[aria-expanded="true"] { border-color: var(--studio-accent); }
.studio-font-trigger span, .studio-font-choice span, .font-file span, .font-custom { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.studio-font-trigger svg, .studio-font-menu svg { flex: none; }
.studio-font-menu { position: fixed; z-index: 120; box-sizing: border-box; display: flex; flex-direction: column; width: 296px; max-width: calc(100vw - 8px); min-width: 0; margin: 0; padding: 0; overflow: hidden; color-scheme: dark; color: var(--studio-text); background: var(--studio-bg-soft); border: 1px solid var(--studio-border); border-radius: 6px; box-shadow: var(--studio-shadow); }
.studio-font-menu button { border: 0; background: transparent; color: inherit; }
.studio-font-menu button:focus-visible { outline: 2px solid var(--studio-accent); outline-offset: -2px; }
.studio-font-menu button:disabled, .studio-font-menu:disabled button, .studio-font-trigger:disabled { opacity: .5; cursor: default; }
.font-search { display: flex; flex: none; align-items: center; gap: 8px; padding: 0 12px; height: 37px; color: var(--studio-text-dim); border-bottom: 1px solid var(--studio-border); }
.font-search:focus-within svg { color: var(--studio-accent); }
.font-search input { flex: 1; min-width: 0; appearance: none; padding: 0; font: inherit; color: var(--studio-text); background: transparent; border: 0; outline: none; }
.font-search input::-webkit-search-cancel-button { appearance: none; }
.font-list { min-height: 0; max-height: 270px; padding: 3px; }
.font-scroll { overflow-y: auto; overscroll-behavior: contain; }
.font-scroll::-webkit-scrollbar { width: 7px; }
.font-scroll::-webkit-scrollbar-track, .font-scroll::-webkit-scrollbar-corner { background: transparent; }
.font-scroll::-webkit-scrollbar-thumb { border: 2px solid transparent; border-radius: 5px; background: var(--studio-text-dim); background-clip: padding-box; }
.font-scroll::-webkit-scrollbar-button { display: none; width: 0; height: 0; }
@supports not selector(::-webkit-scrollbar) { .font-scroll { scrollbar-width: thin; scrollbar-color: var(--studio-text-dim) transparent; } }
.font-list h4, .font-status { margin: 0; padding: 5px 9px 3px; font-family: inherit; font-size: 11px; line-height: 16px; font-weight: 500; color: var(--studio-text-dim); }
.studio-font-menu .studio-font-choice, .font-custom { display: flex; align-items: center; justify-content: space-between; width: 100%; height: 31px; padding: 0 9px; border-radius: 3px; text-align: left; }
.studio-font-choice span { font-size: 15px; line-height: 1.5; }
.studio-font-choice[aria-pressed="true"] { background: var(--studio-accent-soft); }
.studio-font-choice svg { color: var(--studio-accent); }
.studio-font-menu button:hover:not(:disabled):not(.font-apply) { background: var(--studio-bg-hover); }
.font-footer { flex: none; padding: 3px; border-top: 1px solid var(--studio-border); }
.font-import-action, .font-file, .font-import-form header { display: flex; align-items: center; gap: 8px; }
.font-import-action { width: 100%; height: 32px; padding: 0 9px; border-radius: 3px; text-align: left; }
.font-import-action svg { color: var(--studio-accent); }
.font-import-form { display: grid; gap: 12px; padding: 10px 12px 12px; min-height: 0; }
.font-import-form header { gap: 5px; }
.font-back { display: grid; place-items: center; width: 26px; height: 26px; margin-left: -5px; border-radius: 3px; }
.studio-font-menu .font-file { width: 100%; padding: 7px 8px; border: 1px solid var(--studio-border); border-radius: 4px; }
.font-file span { flex: 1; text-align: left; }
.font-file svg { color: var(--studio-text-dim); }
.font-face { display: grid; grid-template-columns: 1fr 1.4fr; gap: 12px; }
.font-field { display: grid; gap: 4px; min-width: 0; color: var(--studio-text-dim); font-size: 12px; }
.studio-font-menu .font-field input, .font-weight, .font-styles { width: 100%; min-width: 0; height: 30px; border: 1px solid var(--studio-border); border-radius: 4px; background: var(--studio-bg); color: var(--studio-text); }
.studio-font-menu .font-field input { appearance: none; padding: 0 8px; font: inherit; font-size: 13px; }
.font-weight { display: grid; grid-template-columns: 23px minmax(0, 1fr) 23px; align-items: center; padding: 2px; }
.font-weight button { display: grid; height: 24px; place-items: center; padding: 0; border-radius: 2px; }
.studio-font-menu .font-weight input { height: 24px; padding: 0; border: 0; background: transparent; text-align: center; appearance: textfield; }
.font-field input::-webkit-inner-spin-button, .font-field input::-webkit-outer-spin-button { appearance: none; margin: 0; }
.font-styles { display: flex; padding: 2px; }
.font-styles button { flex: 1; border-radius: 2px; }
.font-styles button[aria-pressed="true"] { background: var(--studio-bg-hover); color: var(--studio-text); font-weight: 600; }
.studio-font-menu .font-apply { justify-self: end; padding: 6px 12px; border-radius: 4px; background: var(--studio-accent-soft); color: var(--studio-text); }
.studio-font-menu .font-apply:hover:not(:disabled) { background: var(--studio-bg-hover); }
</style>
