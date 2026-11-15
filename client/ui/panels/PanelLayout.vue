<script setup lang="ts">
import { action, t } from '../../i18n'
import { computed } from 'vue'
import type { ObjectRow } from '../../md/literals'
import { formatObjectArray, formatStringArray, parseObjectArray, parseStringArray } from '../../md/literals'
import { useCatalog } from '../../composables/useCatalog'
import { useStudio } from '../../context'
import PropField from '../parts/PropField.vue'
import StudioField from '../parts/StudioField.vue'
import ColorSwatch from '../parts/ColorSwatch.vue'
import { imagePending, useImageInsertion } from '../../composables/useImageInsertion'
import { changePageBackground, isFreeCanvasPage, usePageBackground } from '../../composables/usePageBackground'
import { readPageBackground } from '../../md/background'
import { busy, editing } from '../../state'

/**
 * Page name and the parameters the existing layout actually uses.
 * Layout selection and generic Slidev configuration stay in source. Writes
 * patch frontmatter key by key, so untouched keys keep their formatting.
 */
const studio = useStudio()
const { layouts } = useCatalog()
const images = useImageInsertion()
const { available: backgroundAvailable } = usePageBackground()
const background = computed(() => readPageBackground(studio.content()))

function setBackgroundColor(value: string) {
  if (busy.value || editing.value || imagePending.value || studio.frontmatter().layout !== 'none' || !isFreeCanvasPage(studio.no(), studio.content())) return
  return changePageBackground(studio, value ? { kind: 'color', value } : null)
}
function clearBackground() {
  if (busy.value || editing.value || imagePending.value) return
  return changePageBackground(studio, null)
}

const frontmatter = computed(() => studio.frontmatter())
const currentLayout = computed(() => frontmatter.value.layout ?? (studio.no() === 1 ? 'cover' : 'default'))

/**
 * A layout takes its props from the slide's frontmatter, so this is a form over
 * frontmatter rather than over markup. On a slide like `layout: fact`, whose
 * entire visible text is `value` and `label`, it is the only way to edit it:
 * that text never passed through Markdown, so there is nothing on the canvas to
 * click.
 */
const layoutProps = computed(() => {
  const active = layouts.find(l => l.name === currentLayout.value)
  return (active?.props ?? []).filter(p => !p.hidden && !RESERVED.has(p.name))
})

/** Slidev control fields are edited in source, not exposed as page options. */
const RESERVED = new Set(['title', 'class', 'layoutClass', 'clicks', 'hide', 'level', 'layout', 'transition', 'zoom', 'preload', 'src', 'routeAlias'])

function propValue(name: string): string | boolean | null {
  const value = frontmatter.value[name]
  if (value === undefined || value === null)
    return null
  // Booleans must stay booleans: stringified, `stroke: true` read as the text
  // "true", the control showed "No", and choosing "No" changed nothing.
  if (typeof value === 'boolean')
    return value

  /*
   * Frontmatter holds real YAML, so a key can be a list of records: a split
   * layout's panes, an agenda's items. The controls that edit those read the
   * literal a component prop would be written with, and handing them `String()`
   * of a parsed array produced "[object Object],[object Object]", which is
   * neither editable nor readable. Writing the literal back out gives the same
   * row editor the Element panel uses.
   */
  if (Array.isArray(value)) {
    if (value.length && value.every(entry => entry !== null && typeof entry === 'object' && !Array.isArray(entry)))
      return formatObjectArray(value as ObjectRow[])
    if (value.every(entry => typeof entry === 'string'))
      return formatStringArray(value as string[])
  }

  if (typeof value === 'object')
    return JSON.stringify(value)

  return String(value)
}

async function setProp(prop: { name: string, type?: string }, value: string | boolean | null) {
  await studio.setFrontmatter({ [prop.name]: coerce(prop.type, value) }, action('actionSet', { name: prop.name }))
}

/** Frontmatter is YAML, so a number should land as a number, not a string. */
function coerce(type: string | undefined, value: string | boolean | null) {
  if (value === null || value === '')
    return null
  if (typeof value === 'boolean')
    return value
  // A list edited as rows comes back as the literal, and frontmatter wants the
  // structure, not the text of it.
  const rows = parseObjectArray(value)
  if (rows)
    return rows
  const list = parseStringArray(value)
  if (list)
    return list

  const kind = (type ?? '').toLowerCase()
  if (kind.includes('number') && !kind.includes('string') && value.trim() !== '' && !Number.isNaN(Number(value)))
    return Number(value)
  return value
}


function set(key: string, value: unknown) {
  return studio.setFrontmatter({ [key]: value === '' ? null : value }, action('actionSet', { name: key }))
}

</script>

<template>
  <section class="studio-section">
    <StudioField :label="t('pageName')">
      <input type="text" :value="frontmatter.title ?? ''" :placeholder="t('titlePlaceholder')" @change="set('title', ($event.target as HTMLInputElement).value)">
    </StudioField>
    <p class="studio-hint">{{ t('pageNameHint') }}</p>
  </section>

  <section v-if="currentLayout === 'none' || background" class="studio-section">
    <h3 class="studio-section__title">{{ t('background') }}</h3>
    <fieldset class="studio-element-fields" :disabled="busy || editing || imagePending || !backgroundAvailable">
      <StudioField :label="t('backgroundColor')"><ColorSwatch :value="background?.kind === 'color' ? background.value : ''" @change="setBackgroundColor" /></StudioField>
      <div class="studio-button-row"><button class="studio-button" @click="images.backgroundFromFile()">{{ t('imageFromFile') }}</button><button class="studio-button" @click="images.backgroundFromLibrary()">{{ t('imageFromLibrary') }}</button></div>
    </fieldset>
    <p v-if="background?.kind === 'image'" class="studio-hint">{{ t('backgroundImageHint') }}</p>
    <button v-if="background" class="studio-button" :disabled="busy || editing || imagePending" @click="clearBackground">{{ t('clearBackground') }}</button>
    <p class="studio-hint">{{ backgroundAvailable ? t('backgroundHint') : t('backgroundFreeCanvasOnly') }}</p>
  </section>

  <section v-if="layoutProps.length" class="studio-section">
    <h3 class="studio-section__title">{{ t('currentPageOptions') }}</h3>
    <PropField
      v-for="prop in layoutProps"
      :key="prop.name"
      :prop="prop"
      :value="propValue(prop.name)"
      @change="setProp(prop, $event)"
    />
  </section>
</template>
