<script setup lang="ts">
import { ref, watch } from 'vue'
import { useStudio } from '../context'
import { t } from '../i18n'
import { notesVisible } from '../state'
import StudioIcon from './parts/StudioIcon.vue'

const studio = useStudio()
const note = ref(studio.note())
watch(() => studio.note(), value => (note.value = value))
</script>

<template>
  <section class="studio-notes">
    <header><label for="studio-note">{{ t('presenterNotes') }}</label><button class="studio-icon-button" :title="t('hideNotes')" @click="notesVisible = false"><StudioIcon name="close" :size="14" /></button></header>
    <textarea id="studio-note" v-model="note" :placeholder="t('notesPlaceholder')" spellcheck="false" @change="studio.setNote(note)" />
  </section>
</template>
