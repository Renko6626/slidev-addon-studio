<script setup lang="ts">
import { computed, nextTick, onMounted, onScopeDispose, shallowRef, watch } from 'vue'
import { useStudio } from '../../context'
import { mappedElements } from '../../dom'
import { describeTarget } from '../../composables/useSelection'
import { action, t, targetLabel } from '../../i18n'
import { canMoveLayer, objectLayers, reorderLayers } from '../../layers'
import type { LayerMove, StudioLayer } from '../../layers'
import { busy, editing, missed, selectedTargets, selection } from '../../state'
import { imagePending } from '../../composables/useImageInsertion'
import StudioIcon from '../parts/StudioIcon.vue'

const studio = useStudio()
const groups = shallowRef<StudioLayer[][]>([])
const locked = computed(() => busy.value || editing.value || imagePending.value)
function refresh() {
  groups.value = objectLayers(mappedElements(studio.no()).map(el => describeTarget(el, studio.no(), studio.content())), studio.content())
}
watch([studio.no, studio.content, selection], () => nextTick(refresh), { immediate: true })
// Source is reactive, while Slidev mounts its rebuilt DOM a little later.
// Observe that canvas only; Studio's own list updates must not refresh itself.
let observer: MutationObserver | null = null
onMounted(() => {
  refresh()
  observer = new MutationObserver(records => {
    if (records.some(record => record.target instanceof Element && record.target.closest('#slide-content')
      || [...record.addedNodes].some(node => node instanceof Element && (node.matches('#slide-content') || node.querySelector('#slide-content')))))
      refresh()
  })
  observer.observe(document.body, { childList: true, subtree: true })
})
onScopeDispose(() => observer?.disconnect())

const currentGroup = computed(() => groups.value.find(group => group.some(item => item.target.el === selection.value?.el)))
const commands = [
  { id: 'front', label: 'layerToFront', icon: 'layer-front' },
  { id: 'forward', label: 'layerForward', icon: 'up' },
  { id: 'backward', label: 'layerBackward', icon: 'down' },
  { id: 'back', label: 'layerToBack', icon: 'layer-back' },
] as const
function enabled(direction: LayerMove) {
  return !locked.value && selectedTargets.value.length === 1 && !!selection.value && !!currentGroup.value && canMoveLayer(currentGroup.value, selection.value, direction)
}
async function move(direction: LayerMove) {
  if (!enabled(direction) || !currentGroup.value || !selection.value) return
  const next = reorderLayers(studio.content(), currentGroup.value, selection.value, direction)
  await studio.commit(next, action('actionLayerOrder'))
  refresh()
}
function choose(item: StudioLayer) {
  if (locked.value) return
  missed.value = false
  selection.value = item.target
}
function summary(item: StudioLayer) {
  const el = item.target.el
  return (el.getAttribute('alt') || el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 70)
}
</script>

<template>
  <div class="studio-layers">
    <div class="studio-layer-actions" :aria-label="t('layerOrder')">
      <button v-for="command in commands" :key="command.id" class="studio-icon-button" :title="t(command.label)" :aria-label="t(command.label)" :disabled="!enabled(command.id)" @click="move(command.id)">
        <StudioIcon :name="command.icon" />
      </button>
    </div>
    <p class="studio-hint">{{ t('layersHint') }}</p>
    <p v-if="selectedTargets.length > 1" class="studio-hint">{{ t('layerSingleSelectionHint') }}</p>
    <p v-if="!groups.length" class="studio-empty">{{ t('layersEmpty') }}</p>
    <section v-for="(group, index) in groups" :key="index" class="studio-layer-group">
      <h4 v-if="groups.length > 1">{{ t('layerContainer', { number: index + 1 }) }}</h4>
      <ul class="studio-layer-list" :aria-label="t('layers')">
        <li v-for="(item, itemIndex) in group" :key="`${item.target.range?.join(',')}:${itemIndex}`">
          <button :disabled="locked" :aria-pressed="selection?.el === item.target.el" @click="choose(item)">
            <StudioIcon :name="item.target.element === 'image' ? 'assets' : item.target.element === 'text' ? 'edit' : 'components'" />
            <span class="studio-layer-label"><strong>{{ targetLabel(item.target) }}</strong><small v-if="summary(item)">{{ summary(item) }}</small></span>
            <span v-if="!item.orderable" class="studio-layer-select-only" :title="t('layerSelectOnlyHint')">{{ t('layerSelectOnly') }}</span>
          </button>
        </li>
      </ul>
    </section>
    <p v-if="currentGroup && selection && !currentGroup.find(item => item.target.el === selection?.el)?.orderable" class="studio-hint">{{ t('layerSelectOnlyHint') }}</p>
  </div>
</template>
