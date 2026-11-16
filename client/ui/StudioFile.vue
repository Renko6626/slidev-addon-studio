<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useNav } from '@slidev/client'
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
const nav = useNav()
const host = projectHost()
const hostWorking = ref(false)
const webPlaybackExporting = ref(false)
const { project, loading, downloading, exporting, error, refresh, download, exportPresentation } = useProject(studio.save)
const exporterAvailable = nav.router.hasRoute('export')
const locked = computed(() => busy.value || projectSaving.value || downloading.value || exporting.value || hostWorking.value || webPlaybackExporting.value)
const savedTime = computed(() => projectSavedAt.value ? new Date(projectSavedAt.value).toLocaleTimeString() : '')
onMounted(refresh)
function openExporter() {
  if (locked.value || !exporterAvailable) return
  return exportPresentation(() => {
    if (host) {
      // The desktop's existing window-open handler opens this in the system
      // browser, where Slidev can request sharing the current tab for capture.
      const url = new URL(`${import.meta.env.BASE_URL}export?studio=0`, window.location.origin)
      window.open(url.href, '_blank', 'noopener,noreferrer')
      return
    }
    return nav.router.push({ name: 'export', query: { studio: '0' } })
  })
}
async function importProject() {
  if (!host?.importProject || locked.value) return
  hostWorking.value = true
  error.value = null
  try {
    const result = await host.importProject()
    if (result.error) error.value = result.error
  }
  catch (cause) { error.value = cause instanceof Error ? cause.message : String(cause) }
  finally { hostWorking.value = false }
}
async function exportWebPlayback() {
  if (!host?.exportWebPlayback || locked.value) return
  webPlaybackExporting.value = true
  error.value = null
  try {
    const result = await host.exportWebPlayback()
    if (result.error) error.value = result.error
  }
  catch (cause) { error.value = cause instanceof Error ? cause.message : String(cause) }
  finally { webPlaybackExporting.value = false }
}
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
        <button v-if="host.importProject" :disabled="locked" @click="importProject"><StudioIcon name="folder" />{{ t('importProjectZip') }}</button>
      </template>
      <button :disabled="locked" @click="studio.save"><StudioIcon name="save" /><span>{{ t('saveProject') }}<small>Ctrl / Cmd + S</small></span></button>
      <button v-if="host" :disabled="locked" @click="hostAction('saveAs')"><StudioIcon name="copy" />{{ t('saveProjectAs') }}</button>
      <button :disabled="locked || !exporterAvailable" @click="openExporter"><StudioIcon name="download" /><span>{{ t('exportPresentation') }}<small>PDF / PNG / PPTX</small></span></button>
      <button v-if="host?.exportWebPlayback" :disabled="locked" @click="exportWebPlayback"><StudioIcon name="download" /><span>{{ t(webPlaybackExporting ? 'webPlaybackExporting' : 'exportWebPlayback') }}<small>Windows x64</small></span></button>
      <button :disabled="locked || loading || !project" @click="download"><StudioIcon name="download" /><span>{{ t(downloading ? 'projectDownloading' : 'downloadProject') }}<small>{{ t('projectZipFormat') }}</small></span></button>
      <button v-if="host" :disabled="locked" @click="hostAction('close')"><StudioIcon name="close" />{{ t('closeProject') }}</button>
      <button v-if="host" :disabled="hostWorking" @click="hostAction('logs')"><StudioIcon name="folder" />{{ t('projectOpenLogs') }}</button>
      <button v-if="host?.studioUpdate" :disabled="locked" @click="studioUpdate"><StudioIcon name="refresh" />{{ t('studioCheckUpdates') }}</button>
      <p v-if="!host" class="studio-file-menu__hint">{{ t('projectHostHint') }}</p>
    </nav>
    <div class="studio-file-content">
      <header class="studio-file-heading">
        <div><p class="studio-file-eyebrow">{{ t('projectInfo') }}</p><h1 :title="project?.name">{{ project?.name || t('fileTab') }}</h1></div>
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
        <section class="studio-file-section">
          <h2>{{ t('exportPresentation') }}</h2>
          <p>{{ t('presentationExportHint') }}</p>
          <p v-if="host" class="studio-file-note">{{ t('presentationExportBrowserHint') }}</p>
          <p class="studio-file-note">{{ t('presentationExportPdfHint') }}</p>
          <p class="studio-file-note">{{ t('presentationExportImagesHint') }}</p>
          <button class="studio-button studio-file-action" :disabled="locked || !exporterAvailable" @click="openExporter"><StudioIcon name="download" />{{ t('openPresentationExporter') }}</button>
          <p v-if="!exporterAvailable" class="studio-file-note">{{ t('presentationExportDisabled') }}</p>
        </section>
        <section v-if="host?.exportWebPlayback" class="studio-file-section">
          <h2>{{ t('exportWebPlayback') }}</h2>
          <p>{{ t('webPlaybackHint') }}</p>
          <p v-if="webPlaybackExporting" class="studio-file-note" role="status">{{ t('webPlaybackBusyHint') }}</p>
          <button class="studio-button studio-file-action" :disabled="locked" @click="exportWebPlayback"><StudioIcon name="download" />{{ t(webPlaybackExporting ? 'webPlaybackExporting' : 'exportWebPlayback') }}</button>
        </section>
        <section v-if="host?.importProject" class="studio-file-section">
          <h2>{{ t('importProjectZip') }}</h2>
          <p>{{ t('projectImportHint') }}</p>
          <button class="studio-button studio-file-action" :disabled="locked" @click="importProject"><StudioIcon name="folder" />{{ t('importProjectZip') }}</button>
        </section>
        <section class="studio-file-section">
          <h2>{{ t('projectFiles') }}</h2>
          <p class="studio-file-note">{{ t('projectFilesHint') }}</p>
          <p v-if="host?.nativeProjectManagement" class="studio-file-note">{{ t('desktopManagementHint') }}</p>
          <button v-if="host" class="studio-button studio-file-action" :disabled="locked" @click="hostAction('openFolder')"><StudioIcon name="folder" :size="14" />{{ t('projectOpenFolder') }}</button>
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
