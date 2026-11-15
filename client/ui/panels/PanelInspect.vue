<script setup lang="ts">
import { action, t, targetLabel } from '../../i18n'
import { catalogDescription } from '../../i18n/catalog'
import { computed, ref, watch } from 'vue'
import { configs } from '@slidev/client/env.ts'
import { useCatalog } from '../../composables/useCatalog'
import { useStudio } from '../../context'
import { readProp, writeProp } from '../../md/props'
import { readDrag, writeDrag } from '../../md/drag'
import { readElement, resizeElement } from '../../md/elements'
import { getBlock, replaceBlock } from '../../md/lines'
import { canStyle, readClasses, writeClasses } from '../../md/classes'
import { canReorder, deleteBlock, duplicateBlock, freePosition } from '../../actions'
import { busy, editing, missed, selection, selectedTargets } from '../../state'
import PropField from '../parts/PropField.vue'
import StudioField from '../parts/StudioField.vue'
import StudioIcon from '../parts/StudioIcon.vue'
import ShapeFields from '../parts/ShapeFields.vue'
import ImageElementFields from '../parts/ImageElementFields.vue'
import ArrangeSelection from '../parts/ArrangeSelection.vue'
import InteractionFields from '../parts/InteractionFields.vue'
import { isInteractionTag } from '../../md/interactions'

/**
 * The properties panel: where the selected block lives, how it is styled, and
 * the raw Markdown behind it. Every control writes the smallest possible edit
 * back to the slide.
 */
const studio = useStudio()
const { components } = useCatalog()

const element = computed(() => selection.value?.range ? readElement(studio.content(), selection.value.range) : null)
const range = computed(() => selection.value?.range ?? null)
const interaction = computed(() => isInteractionTag(selection.value?.tag))

/** Whether this block can carry a class at all, in Markdown or as an attribute. */
const styleable = computed(() => !!range.value && canStyle(studio.content(), range.value, !!configs.mdc))

/**
 * The catalog entry behind the selected tag, if it is a component. That is
 * where the prop list, its labels and its options come from, so a component
 * gets a real form rather than a text box full of markup.
 */
const component = computed(() => {
  const tag = selection.value?.tag
  return tag ? components.find(c => c.name === tag) ?? null : null
})

const editableProps = computed(() => component.value?.props.filter(p => !p.hidden) ?? [])

function valueOf(prop: (typeof editableProps.value)[number]) {
  return range.value ? readProp(studio.content(), range.value, prop) : null
}

/**
 * Bumped when a prop write leaves the source untouched, to rebuild the fields.
 *
 * A refused write, such as clearing a prop the component requires, leaves the
 * Markdown as it was, so Vue sees the same bound value and the field goes on
 * showing what was typed: the panel then claims a value the deck does not have.
 * Only that case rebuilds. Doing it after every write threw focus out of the
 * form on each keystroke's worth of change, which stopped Tab walking it.
 */
const revision = ref(0)

async function setProp(prop: (typeof editableProps.value)[number], value: string | boolean | null) {
  if (!range.value)
    return

  const before = studio.content()
  const next = writeProp(before, range.value, prop, value)
  await studio.commit(next, action('actionSet', { name: prop.name }))
  if (next === before)
    revision.value += 1
}
const block = computed(() => (range.value ? getBlock(studio.content(), range.value) : ''))
const drag = computed(() => (range.value ? readDrag(studio.content(), range.value) : null))
const pos = computed(() => drag.value?.pos ?? null)

const draft = ref('')
watch(block, value => (draft.value = value), { immediate: true })
const dirty = computed(() => draft.value !== block.value)

const classes = ref('')
watch([block, range], () => {
  classes.value = range.value ? readClasses(studio.content(), range.value) : ''
}, { immediate: true })

/** An emptied height means "size to content", which is `null`, not zero. */
async function setPos(field: 'x' | 'y' | 'w' | 'h' | 'rotate', value: number | null) {
  if (!range.value || !pos.value || busy.value || editing.value)
    return
  if (element.value) {
    await studio.commit(resizeElement(studio.content(), range.value, field, value), action('actionSetPosition'))
    return
  }
  await studio.commit(
    writeDrag(studio.content(), range.value, { ...pos.value, [field]: value }),
    action('actionSetPosition'),
  )
}

async function toFreePosition() {
  if (selection.value)
    await freePosition(studio, selection.value)
}

async function applyClasses() {
  if (!range.value)
    return
  await studio.commit(writeClasses(studio.content(), range.value, classes.value), action('actionSetClasses'))
}

async function applyDraft() {
  if (!range.value || !dirty.value)
    return
  await studio.commit(replaceBlock(studio.content(), range.value, draft.value), action('actionEditBlock'))
}

async function duplicate() {
  if (selection.value)
    await duplicateBlock(studio, selection.value)
}

async function remove() {
  if (selection.value)
    await deleteBlock(studio, selection.value)
}
</script>

<template>
  <div v-if="!selection" class="studio-empty">
    <template v-if="missed">
      <p>{{ t('inspectLayout') }}</p>
      <p class="studio-hint">
        {{ t('inspectLayoutHint') }}
      </p>
    </template>
    <template v-else>
      {{ t('inspectClick') }}
    </template>
  </div>

  <section v-else-if="selectedTargets.length > 1" class="studio-section"><ArrangeSelection actions /></section>

  <div v-else-if="selection?.prop" class="studio-empty">
    <p>
      {{ t('inspectProp', { name: selection.prop }) }}
    </p>
    <p class="studio-hint">
      {{ t('inspectPropHint') }}
    </p>
  </div>

  <div v-else-if="!range" class="studio-empty">
    <p>{{ t('inspectUnmapped') }}</p>
    <p class="studio-hint">
      {{ t('inspectUnmappedHint') }}
    </p>
  </div>

  <template v-else>
    <section class="studio-section">
      <h3 class="studio-section__title">
        {{ targetLabel(selection) }}
      </h3>
      <p v-if="element?.kind === 'text'" class="studio-hint">{{ studio.text.supported.value ? t('textFormatInHome') : t('textSourceFallback') }}</p>
    </section>

    <section v-if="element?.kind === 'shape'" class="studio-section"><ShapeFields /></section>

    <section v-if="element?.kind === 'image'" class="studio-section"><ImageElementFields /></section>
    <section v-if="interaction" class="studio-section"><InteractionFields /></section>

    <section class="studio-section">
      <h3 class="studio-section__title">
        {{ t('position') }}
      </h3>
      <div v-if="!pos" class="studio-button-row">
        <button class="studio-button" @click="toFreePosition">
          <StudioIcon name="free" :size="14" /> {{ t('freePosition') }}
        </button>
      </div>
      <template v-else>
        <StudioField label="X">
          <input type="number" :value="Math.round(pos.x)" @change="setPos('x', +($event.target as HTMLInputElement).value)">
        </StudioField>
        <StudioField label="Y">
          <input type="number" :value="Math.round(pos.y)" @change="setPos('y', +($event.target as HTMLInputElement).value)">
        </StudioField>
        <StudioField :label="t('width')">
          <input type="number" :value="Math.round(pos.w)" @change="setPos('w', +($event.target as HTMLInputElement).value)">
        </StudioField>
        <StudioField v-if="element?.kind !== 'text' && studio.shapes.parameters.value?.kind !== 'line'" :label="t('height')">
          <input
            type="number"
            :value="pos.h === null ? '' : Math.round(pos.h)"
            :placeholder="t('auto')"
            @change="setPos('h', ($event.target as HTMLInputElement).value.trim() === '' ? null : +($event.target as HTMLInputElement).value)"
          >
        </StudioField>
        <StudioField :label="t('rotation')">
          <input type="number" :value="Math.round(pos.rotate)" @change="setPos('rotate', +($event.target as HTMLInputElement).value)">
        </StudioField>
        <p class="studio-hint">
          {{ t('canvasUnits', { width: studio.canvas.slideWidth.value }) }}
        </p>
      </template>
    </section>

    <section v-if="component && !interaction" class="studio-section">
      <h3 class="studio-section__title">
        {{ t('componentProps', { name: component.name }) }}
      </h3>
      <p v-if="!editableProps.length" class="studio-hint">
        {{ t('noProps') }}
      </p>
      <PropField
        v-for="prop in editableProps"
        :key="`${prop.name}-${revision}`"
        :prop="prop"
        :component="component"
        :value="valueOf(prop)"
        @change="setProp(prop, $event)"
      />
      <p v-if="component.description" class="studio-hint">
        {{ catalogDescription(component) }}
      </p>
    </section>

    <section class="studio-section">
      <h3 class="studio-section__title">
        {{ t('objectTab') }}
      </h3>
      <div class="studio-button-row">
        <button class="studio-button" :title="t('duplicate')" :disabled="!canReorder(selection)" @click="duplicate">
          <StudioIcon name="copy" :size="14" />
        </button>
        <button class="studio-button studio-button--danger" :title="t('delete')" @click="remove">
          <StudioIcon name="trash" :size="14" />
        </button>
      </div>
      <p v-if="!canReorder(selection)" class="studio-hint">
        {{ t('nestedArrange') }}
      </p>
    </section>

    <details class="studio-advanced">
      <summary>{{ t('advanced') }}</summary>
      <p class="studio-hint studio-source-location">{{ t('inspectLines', { start: range[0] + 1, end: range[1] }) }}</p>
    <section class="studio-section">
      <h3 class="studio-section__title">
        {{ t('style') }}
      </h3>
      <StudioField v-if="styleable" :label="t('classes')">
        <input v-model="classes" type="text" placeholder="text-xl opacity-80" @change="applyClasses">
      </StudioField>
      <p v-if="!selection.tag && !configs.mdc" class="studio-hint">
        {{ t('classesMdc', { setting: 'mdc: true' }) }}
      </p>
      <p v-else-if="!styleable" class="studio-hint">
        {{ t('classesWrap', { syntax: '{.class}', tag: '<div>' }) }}
      </p>
    </section>

    <section class="studio-section">
      <h3 class="studio-section__title">
        Markdown
      </h3>
      <textarea v-model="draft" rows="6" spellcheck="false" />
      <div class="studio-button-row" style="margin-top: 6px">
        <button class="studio-button" :disabled="!dirty" @click="applyDraft">
          {{ t('apply') }}
        </button>
        <button class="studio-button" :disabled="!dirty" @click="draft = block">
          {{ t('revert') }}
        </button>
      </div>
    </section>
    </details>
  </template>
</template>
