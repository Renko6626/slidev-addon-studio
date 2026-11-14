<script setup lang="ts">
import type { MessageKey } from '../../i18n'
import { action, t } from '../../i18n'
import { catalogDescription } from '../../i18n/catalog'
import { ref } from 'vue'
import { onDomEvent } from '../../composables/useDomEvent'
import { CANVAS_SELECTOR } from '../../dom'
import { computed } from 'vue'
import { BASIC_BLOCKS } from '../../blocks'
import { useCatalog } from '../../composables/useCatalog'
import { useStudio } from '../../context'
import { insertSnippet, positioned } from '../../md/insert'
import { activePanel, selection } from '../../state'
import ComponentPreview from '../parts/ComponentPreview.vue'

/**
 * The component palette: everything this deck can actually use, gathered from
 * Slidev's builtins, the active theme, every addon, and the project itself.
 *
 * Clicking inserts into the flow after whatever is selected. Dragging onto the
 * canvas inserts at the drop point as a free-positioned element.
 */
const emit = defineEmits<{ inserted: [] }>()
const studio = useStudio()
const { query, groups, sources, toggleSource } = useCatalog()

/** Whatever is being dragged onto the canvas, component or plain block. */
const dragging = ref<{ label: string, snippet: string, labelKey?: MessageKey } | null>(null)

const blocks = computed(() => {
  const needle = query.value.trim().toLowerCase()
  return BASIC_BLOCKS
    .map(b => ({ ...b, search: `${b.name} ${b.description}`.toLowerCase(), name: t(b.labelKey), description: t(`${b.labelKey}Description`) }))
    .filter(b => !needle || b.name.toLowerCase().includes(needle) || b.description.toLowerCase().includes(needle)
      || b.search.includes(needle))
})

const sourceFilters = [
  { id: 'project', label: 'project' },
  { id: 'theme', label: 'theme' },
  { id: 'addon', label: 'addons' },
  { id: 'builtin', label: 'Slidev' },
] as const

async function insert(item: { name: string, snippet: string, tag?: string, labelKey?: MessageKey }) {
  const range = selection.value?.range
  await studio.commit(
    insertSnippet(studio.content(), item.snippet, range ? { mode: 'after', range } : { mode: 'append' }),
    action('actionInsert', { name: item.labelKey ? { key: item.labelKey } : item.name }),
  )
  // Something just added is the thing you want to configure, so hand over to
  // the Element panel with it already selected. Matched on the tag it renders,
  // which for a Markdown block is nothing at all: a palette entry's name is a
  // label, and matching on "Heading" or "Numbered list" found nothing, so the
  // panel came back holding a different block.
  await studio.selectInserted(item.tag)
  activePanel.value = 'inspect'
  emit('inserted')
}

onDomEvent<DragEvent>(window, 'dragover', (event) => {
  if (dragging.value && (event.target as Element)?.closest?.(CANVAS_SELECTOR))
    event.preventDefault()
})

onDomEvent<DragEvent>(window, 'drop', async (event) => {
  const component = dragging.value
  dragging.value = null
  if (!component || !(event.target as Element)?.closest?.(CANVAS_SELECTOR))
    return

  event.preventDefault()
  const point = studio.canvas.toCanvas(event.clientX, event.clientY)
  const snippet = positioned(component.snippet, { x: Math.round(point.x), y: Math.round(point.y), w: 260, h: null, rotate: 0 })
  await studio.commit(insertSnippet(studio.content(), snippet, { mode: 'append' }), action('actionPlace', {
    name: component.labelKey ? { key: component.labelKey } : component.label,
  }))
  await studio.selectInserted()
  emit('inserted')
})
</script>

<template>
  <div class="studio-catalog__search">
    <input v-model="query" type="text" :placeholder="t('searchComponents')">
    <div class="studio-segmented" style="margin-top: 8px">
      <button
        v-for="filter in sourceFilters"
        :key="filter.id"
        type="button"
        :aria-pressed="sources.has(filter.id)"
        @click="toggleSource(filter.id)"
      >
        {{ filter.id === 'builtin' ? filter.label : t(filter.label) }}
      </button>
    </div>
  </div>

  <section v-if="blocks.length">
    <h3 class="studio-section__title" style="padding: 12px 12px 0">
      {{ t('basic') }}
    </h3>
    <div class="studio-grid">
      <button
        v-for="block in blocks"
        :key="block.name"
        class="studio-card"
        draggable="true"
        :title="block.description"
        @click="insert(block)"
        @dragstart="dragging = { label: block.name, snippet: block.snippet, labelKey: block.labelKey }"
        @dragend="dragging = null"
      >
        <span class="studio-card__preview">
          <span class="studio-card__placeholder">{{ block.sample }}</span>
        </span>
        <span class="studio-card__label">
          <span class="studio-card__name">{{ block.name }}</span>
          <span class="studio-card__meta">{{ block.description }}</span>
        </span>
      </button>
    </div>
  </section>

  <div v-if="!groups.length && !blocks.length" class="studio-empty">
    {{ t('noMatches') }}
  </div>

  <section v-for="[group, items] in groups" :key="group">
    <h3 class="studio-section__title" style="padding: 12px 12px 0">
      {{ group }}
    </h3>
    <div class="studio-grid">
      <button
        v-for="component in items"
        :key="component.name"
        class="studio-card"
        draggable="true"
        :title="catalogDescription(component) ?? component.name"
        @click="insert({ ...component, tag: component.name })"
        @dragstart="dragging = { label: component.name, snippet: component.snippet }"
        @dragend="dragging = null"
      >
        <ComponentPreview :component="component" />
        <span class="studio-card__label">
          <span class="studio-card__name">{{ component.name }}</span>
          <span v-if="component.description" class="studio-card__meta">{{ catalogDescription(component) }}</span>
        </span>
      </button>
    </div>
  </section>

  <p class="studio-hint" style="padding: 0 12px 16px">
    {{ t('insertHint') }}
  </p>
</template>
