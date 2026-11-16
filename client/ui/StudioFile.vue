<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useStudio } from '../context'
import { useProject } from '../composables/useProject'
import { t } from '../i18n'
import { projectSavedAt, projectSaveStatus, projectSaving, projectWriteError } from '../project-save'
import { busy, ribbonTab } from '../state'
import { projectHost } from '../project-host'
import type { ProjectHostAction } from '../project-host'
import StudioIcon from './parts/StudioIcon.vue'
import ProjectTree from './parts/ProjectTree.vue'

const studio = useStudio()
const host = projectHost()
const hostWorking = ref(false)
const { project, loading, downloading, error, refresh, download } = useProject(studio.save)
const locked = computed(() => busy.value || projectSaving.value || downloading.value || hostWorking.value)
const savedTime = computed(() => projectSavedAt.value ? new Date(projectSavedAt.value).toLocaleTimeString() : '')
const authoringSkill = 'node_modules/slidev-addon-studio/skills/studio-authoring/SKILL.md'
onMounted(refresh)
async function hostAction(action: ProjectHostAction) {
  if (!host || locked.value) return
  hostWorking.value = true
  error.value = null
  try {
    const result = await host.perform(action)
    if (result.error) error.value = result.error
  }
  catch (cause) { error.value = cause instanceof Error ? cause.message : String(cause) }
  finally { hostWorking.value = false }
}
async function studioUpdate() {
  if (!host?.studioUpdate || locked.value) return
  hostWorking.value = true
  error.value = null
  try {
    const result = await host.studioUpdate()
    if (result.error) error.value = result.error
  }
  catch (cause) { error.value = cause instanceof Error ? cause.message : String(cause) }
  finally { hostWorking.value = false }
}
</script>

<template>
  <section class="studio-file-page" :aria-label="t('fileTab')">
    <nav class="studio-file-menu" :aria-label="t('projectActions')">
      <button class="studio-file-menu__back" @click="ribbonTab = 'home'"><StudioIcon name="back" />{{ t('returnEditor') }}</button>
      <template v-if="host">
        <button :disabled="locked" @click="hostAction('new')"><StudioIcon name="plus" />{{ t('newProject') }}</button>
        <button :disabled="locked" @click="hostAction('open')"><StudioIcon name="folder" />{{ t('openProject') }}</button>
      </template>
      <button :disabled="locked" @click="studio.save"><StudioIcon name="save" /><span>{{ t('saveProject') }}<small>Ctrl / Cmd + S</small></span></button>
      <button v-if="host" :disabled="locked" @click="hostAction('saveAs')"><StudioIcon name="copy" />{{ t('saveProjectAs') }}</button>
      <button :disabled="locked || loading || !project" @click="download"><StudioIcon name="download" /><span>{{ t(downloading ? 'projectDownloading' : 'downloadProject') }}<small>{{ t('projectZipFormat') }}</small></span></button>
      <button v-if="host" :disabled="locked" @click="hostAction('close')"><StudioIcon name="close" />{{ t('closeProject') }}</button>
      <button v-if="host" :disabled="hostWorking" @click="hostAction('logs')"><StudioIcon name="folder" />{{ t('projectOpenLogs') }}</button>
      <button v-if="host?.studioUpdate" :disabled="locked" @click="studioUpdate"><StudioIcon name="refresh" />{{ t('studioCheckUpdates') }}</button>
      <p v-if="!host" class="studio-file-menu__hint">{{ t('projectHostHint') }}</p>
    </nav>
    <div class="studio-file-content">
      <header class="studio-file-heading">
        <div><p class="studio-file-eyebrow">{{ t('projectInfo') }}</p><h1>{{ project?.name || t('fileTab') }}</h1></div>
        <button class="studio-button" :disabled="loading || locked" @click="refresh"><StudioIcon name="refresh" :size="14" />{{ t('projectRefresh') }}</button>
      </header>
      <p v-if="loading" role="status">{{ t('projectLoading') }}</p>
      <p v-if="error" class="studio-file-error" role="alert">{{ error }}</p>
      <div v-if="project" class="studio-file-overview">
        <dl class="studio-project-info">
          <div><dt>{{ t('projectLocation') }}</dt><dd><button v-if="host" class="studio-project-path" :disabled="locked" :title="t('projectOpenFolder')" @click="hostAction('openFolder')"><code>{{ project.root }}</code><StudioIcon name="folder" :size="14" /></button><code v-else>{{ project.root }}</code></dd></div>
          <div><dt>{{ t('projectEntry') }}</dt><dd><code>{{ project.entry }}</code></dd></div>
          <div><dt>{{ t('projectSaveLabel') }}</dt><dd role="status" :class="{ 'studio-file-error': projectWriteError }">{{ t(projectSaveStatus()) }}<small v-if="savedTime && !projectWriteError">{{ t('projectSavedTime', { time: savedTime }) }}</small></dd></div>
        </dl>
        <p class="studio-file-note">{{ t('projectLocationHint') }}</p>
        <p v-if="projectWriteError" class="studio-file-error" role="alert">{{ projectWriteError }}<br>{{ t('projectWriteFailed') }}</p>
        <p class="studio-file-note">{{ t('projectAutosaveHint') }}</p>
        <section v-if="host" class="studio-file-section">
          <h2>{{ t('projectAgentTitle') }}</h2>
          <p>{{ t('projectAgentHint') }}</p>
          <p><code>{{ project.root }}</code></p>
          <p class="studio-file-note">{{ t('projectAgentSkillHint') }}</p>
          <p><code>{{ authoringSkill }}</code></p>
          <button class="studio-button" :disabled="locked" @click="hostAction('openFolder')"><StudioIcon name="folder" :size="14" />{{ t('projectOpenFolder') }}</button>
        </section>
        <section class="studio-file-section">
          <h2>{{ t('projectFiles') }}</h2>
          <p class="studio-file-note">{{ t('projectFilesHint') }}</p>
          <ProjectTree :files="project.files" />
        </section>
        <section class="studio-file-section">
          <h2>{{ t('projectExportTitle') }}</h2>
          <p>{{ t('projectZipHint') }}</p>
          <p class="studio-file-note">{{ t('projectExcludedHint') }}</p>
        </section>
      </div>
    </div>
  </section>
</template>
