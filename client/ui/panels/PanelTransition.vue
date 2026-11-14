<script setup lang="ts">
import { action, t } from '../../i18n'
import type { MessageKey } from '../../i18n'
import { useStudio } from '../../context'
import StudioField from '../parts/StudioField.vue'
const studio = useStudio()
async function setTransition(value: string) {
  await studio.setFrontmatter({ transition: value || null }, action('actionSetTransition'))
}
const transitionLabels: Record<string, MessageKey> = {
  fade: 'transitionFade', 'fade-out': 'transitionFadeOut', 'slide-left': 'transitionLeft',
  'slide-right': 'transitionRight', 'slide-up': 'transitionUp', 'slide-down': 'transitionDown',
  'view-transition': 'transitionView', none: 'transitionNone',
}

const TRANSITIONS = ['', 'fade', 'fade-out', 'slide-left', 'slide-right', 'slide-up', 'slide-down', 'view-transition', 'none']
</script>

<template>
  <section class="studio-section">
    <h3 class="studio-section__title">
      {{ t('slideTransition') }}
    </h3>
    <StudioField :label="t('leaving')">
      <select :value="studio.frontmatter().transition ?? ''" @change="setTransition(($event.target as HTMLSelectElement).value)">
        <option v-for="option in TRANSITIONS" :key="option" :value="option">
          {{ option ? t(transitionLabels[option]) : t('inheritDeck') }}
        </option>
      </select>
    </StudioField>
  </section>
</template>
