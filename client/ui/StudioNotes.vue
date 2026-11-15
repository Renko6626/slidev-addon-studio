<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useStudio } from '../context'
import { t } from '../i18n'
import { notesVisible } from '../state'
import StudioIcon from './parts/StudioIcon.vue'

const studio = useStudio()
const note = ref(studio.note())
watch(() => studio.note(), value => (note.value = value))
const dirty = computed(() => note.value !== studio.note())
async function apply() {
  if (dirty.value) await studio.setNote(note.value)
}
defineExpose({ apply, dirty })
</script>

<template>
  <section class="studio-notes">
    <header><label for="studio-note">{{ t('presenterNotes') }}</label><button class="studio-icon-button" :title="t('hideNotes')" @click="notesVisible = false"><StudioIcon name="close" :size="14" /></button></header>
    <textarea id="studio-note" v-model="note" :placeholder="t('notesPlaceholder')" spellcheck="false" @change="apply" />
  </section>
</template>
