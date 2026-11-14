<script setup lang="ts">
import { computed, useId } from 'vue'
import { useStudio } from '../../context'
import { t } from '../../i18n'
import { busy, editing, selection } from '../../state'
import type { TextCommand } from '../../text/editor'
import ColorSwatch from './ColorSwatch.vue'
import StudioField from './StudioField.vue'
import StudioIcon from './StudioIcon.vue'

defineProps<{ compact?: boolean }>()
const { text } = useStudio()
const { editor, format, supported, scope } = text
const disabled = computed(() => busy.value || !supported.value || (editing.value && !editor.value))
const fontId = useId()
const sizeId = useId()
const fonts = ['sans-serif', 'serif', 'monospace', 'Arial', 'Calibri', 'Verdana', 'Georgia', 'Times New Roman', 'Microsoft YaHei', 'SimSun', 'SimHei', 'Noto Sans CJK SC']
const sizes = [8, 10, 12, 14, 16, 18, 20, 24, 28, 32, 36, 40, 48, 60, 72, 96]
const lineHeights = ['1', '1.15', '1.3', '1.5', '2', '2.5', '3']
const marks = [
  { id: 'bold', label: 'bold' }, { id: 'italic', label: 'italic' },
  { id: 'underline', label: 'underline' }, { id: 'strike', label: 'strikethrough' },
] as const
const alignments = [
  { id: 'left', label: 'alignLeft' }, { id: 'center', label: 'alignCenter' },
  { id: 'right', label: 'alignRight' }, { id: 'justify', label: 'alignJustify' },
] as const
function run(command: TextCommand, value?: string) { void text.run(command, value) }
</script>

<template>
  <fieldset v-if="selection?.element === 'text'" class="studio-element-fields studio-rich-fields" :class="{ 'studio-rich-fields--compact': compact }" :disabled="disabled" data-studio-text-controls :title="supported ? t(scope) : t('textSourceFallback')">
    <div class="studio-rich-fields__font">
      <StudioField :label="t('fontFamily')">
        <input type="text" class="studio-font-name" :list="fontId" :value="format?.fontFamily ?? ''" :placeholder="t('mixedFormat')" @change="run('fontFamily', ($event.target as HTMLInputElement).value)">
        <datalist :id="fontId"><option v-for="font in fonts" :key="font" :value="font" /></datalist>
      </StudioField>
      <StudioField :label="t('fontSizePx')">
        <input type="number" min="8" max="200" step="1" :list="sizeId" :value="format?.fontSize ?? ''" :placeholder="t('mixedFormat')" @change="run('fontSize', ($event.target as HTMLInputElement).value)">
        <datalist :id="sizeId"><option v-for="size in sizes" :key="size" :value="size" /></datalist>
      </StudioField>
      <StudioField :label="t('textColor')"><ColorSwatch :value="format?.color ?? ''" :placeholder="format?.color === null ? t('mixedFormat') : undefined" @change="run('color', $event)" /></StudioField>
      <div class="studio-text-buttons" role="group" :aria-label="t('textFormat')">
        <button v-for="mark in marks" :key="mark.id" class="studio-icon-button" :aria-pressed="format?.[mark.id] ?? false" :title="t(mark.label)" @click="run(mark.id)"><StudioIcon :name="mark.id" /></button>
        <button class="studio-icon-button" :title="t('clearTextFormat')" @click="run('clear')"><StudioIcon name="clear-format" /></button>
      </div>
    </div>
    <div class="studio-rich-fields__paragraph">
      <div class="studio-text-buttons" role="group" :aria-label="t('textAlignment')">
        <button v-for="align in alignments" :key="align.id" class="studio-icon-button" :aria-pressed="format?.align === align.id" :title="t(align.label)" @click="run('align', align.id)"><StudioIcon :name="`align-${align.id}`" /></button>
      </div>
      <div class="studio-text-buttons" role="group" :aria-label="t('textLists')">
        <button class="studio-icon-button" :aria-pressed="format?.bulletList ?? false" :title="t('bulletList')" @click="run('bulletList')"><StudioIcon name="list" /></button>
        <button class="studio-icon-button" :aria-pressed="format?.orderedList ?? false" :title="t('numberedList')" @click="run('orderedList')"><StudioIcon name="ordered-list" /></button>
        <button class="studio-icon-button" :title="t('decreaseIndent')" @click="run('outdent')"><StudioIcon name="outdent" /></button>
        <button class="studio-icon-button" :title="t('increaseIndent')" @click="run('indent')"><StudioIcon name="indent" /></button>
      </div>
      <StudioField :label="t('lineSpacing')">
        <select :value="format?.lineHeight ?? ''" @change="run('lineHeight', ($event.target as HTMLSelectElement).value)">
          <option v-if="format?.lineHeight === null" value="" disabled>{{ t('mixedFormat') }}</option>
          <option v-if="format?.lineHeight && !lineHeights.includes(format.lineHeight)" :value="format.lineHeight">{{ format.lineHeight }}</option>
          <option v-for="height in lineHeights" :key="height" :value="height">{{ height }}</option>
        </select>
      </StudioField>
    </div>
    <p v-if="!compact" class="studio-hint">{{ supported ? t(scope) : t('textSourceFallback') }}</p>
    <p v-if="!compact" class="studio-hint">{{ t('textBoxSizingHint') }}</p>
  </fieldset>
</template>
