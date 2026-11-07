<script setup lang="ts">
import type { MessageKey } from '../i18n'
import { actionText, studioLocale, t } from '../i18n'
import type { PanelId } from '../state'
import { canRedo, canUndo, lastAction, useStudioHistory } from '../composables/useSlideSource'
import { activePanel, gridEnabled, outlineEnabled, snapEnabled, studioOpen } from '../state'
import StudioIcon from './parts/StudioIcon.vue'

const history = useStudioHistory()

/**
 * Only shown while Studio is open. When it is closed the way in is Slidev's own
 * bottom bar, which already holds the deck's controls, so a closed editor adds
 * nothing to the slide.
 */
const tabs: { id: PanelId, icon: string, label: MessageKey }[] = [
  { id: 'inspect', icon: 'cursor', label: 'element' },
  { id: 'components', icon: 'components', label: 'components' },
  { id: 'animate', icon: 'animate', label: 'animate' },
  { id: 'layout', icon: 'layout', label: 'layout' },
  { id: 'slides', icon: 'slides', label: 'slides' },
  { id: 'assets', icon: 'assets', label: 'assets' },
]
</script>

<template>
  <div v-if="studioOpen" class="studio-toolbar">
    <button
      v-for="tab in tabs"
      :key="tab.id"
      class="studio-tab"
      role="tab"
      :aria-selected="activePanel === tab.id"
      :title="t(tab.label)"
      @click="activePanel = tab.id"
    >
      <StudioIcon :name="tab.icon" :size="15" />
      <span>{{ t(tab.label) }}</span>
    </button>

    <span class="studio-toolbar__divider" />

    <button
      class="studio-icon-button"
      :disabled="!canUndo"
      :title="lastAction ? t('undoAction', { action: actionText(lastAction) }) : t('undo')"
      @click="history.undo()"
    >
      <StudioIcon name="undo" />
    </button>
    <button class="studio-icon-button" :disabled="!canRedo" :title="t('redo')" @click="history.redo()">
      <StudioIcon name="redo" />
    </button>

    <span class="studio-toolbar__divider" />

    <button
      class="studio-icon-button"
      :aria-pressed="snapEnabled"
      :title="t('snapGuides')"
      @click="snapEnabled = !snapEnabled"
    >
      <StudioIcon name="magnet" />
    </button>
    <button class="studio-icon-button" :aria-pressed="gridEnabled" :title="t('snapGrid')" @click="gridEnabled = !gridEnabled">
      <StudioIcon name="grid" />
    </button>
    <button
      class="studio-icon-button"
      :aria-pressed="outlineEnabled"
      :title="t('outlineAll')"
      @click="outlineEnabled = !outlineEnabled"
    >
      <StudioIcon name="eye" />
    </button>

    <span class="studio-toolbar__divider" />

    <select v-model="studioLocale" class="studio-language" :aria-label="t('language')" :title="t('language')">
      <option value="en">English</option>
      <option value="zh-CN">简体中文</option>
    </select>

    <button class="studio-icon-button" :title="t('closeStudio')" @click="studioOpen = false">
      <StudioIcon name="close" />
    </button>
  </div>
</template>
