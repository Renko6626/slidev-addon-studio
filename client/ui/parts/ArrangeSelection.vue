<script setup lang="ts">
import { useStudio } from '../../context'
import { arrangeSelection, deleteBlock, duplicateBlock } from '../../actions'
import { busy, editing, selectedTargets, selection } from '../../state'
import { t } from '../../i18n'
import type { MessageKey } from '../../i18n'
import type { Align } from '../../selection-geometry'
const studio = useStudio()
const operations: { id: Align | 'distributeX' | 'distributeY', label: MessageKey }[] = [
  { id: 'left', label: 'objectsAlignLeft' }, { id: 'center', label: 'objectsAlignCenter' }, { id: 'right', label: 'objectsAlignRight' },
  { id: 'top', label: 'objectsAlignTop' }, { id: 'middle', label: 'objectsAlignMiddle' }, { id: 'bottom', label: 'objectsAlignBottom' },
  { id: 'distributeX', label: 'objectsDistributeX' }, { id: 'distributeY', label: 'objectsDistributeY' },
]
defineProps<{ actions?: boolean }>()
</script>

<template>
  <div class="studio-arrange-selection">
    <p class="studio-hint">{{ t('selectedObjects', { count: selectedTargets.length }) }}</p>
    <div class="studio-arrange-selection__buttons">
      <button v-for="operation in operations" :key="operation.id" class="studio-button"
        :disabled="busy || editing || (operation.id.startsWith('distribute') && selectedTargets.length < 3)"
        @click="arrangeSelection(studio, operation.id)">{{ t(operation.label) }}</button>
    </div>
    <div v-if="actions" class="studio-button-row">
      <button class="studio-button" :disabled="busy || editing" @click="selection && duplicateBlock(studio, selection)">{{ t('duplicateObject') }}</button>
      <button class="studio-button studio-button--danger" :disabled="busy || editing" @click="selection && deleteBlock(studio, selection)">{{ t('deleteObject') }}</button>
    </div>
    <p v-if="actions" class="studio-hint">{{ t('multiSelectionHint') }}</p>
  </div>
</template>
