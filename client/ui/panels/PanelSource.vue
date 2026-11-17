<script setup lang="ts">
import { useNav } from '@slidev/client'
import { useDynamicSlideInfo } from '@slidev/client/composables/useSlideInfo.ts'
import { computed, onMounted, ref } from 'vue'
import { useCatalog } from '../../composables/useCatalog'
import { useProject } from '../../composables/useProject'
import { useStudio } from '../../context'
import { t } from '../../i18n'
import { getBlock } from '../../md/lines'
import { projectWriteError } from '../../project-save'
import { pageSourceInfo, pageSource, projectScripts } from '../../source-context'
import { busy, editing, lastCompileError, lastError, selection } from '../../state'
import VueSource from '../parts/VueSource.vue'

const studio = useStudio()
const nav = useNav()
const { info } = useDynamicSlideInfo(nav.currentSlideNo)
const { components } = useCatalog()
const { project, loading, error: projectError, refresh } = useProject(studio.save)
onMounted(refresh)
const page = computed(() => pageSource(info.value))
const location = computed(() => page.value.file + (page.value.line === null ? '' : ':' + page.value.line))
const component = computed(() => components.find(item => item.name === selection.value?.tag) ?? null)
const scripts = computed(() => projectScripts(project.value?.files ?? []))
const diagnostic = computed(() => [lastCompileError.value, projectWriteError.value, lastError.value].filter(Boolean).join('\n\n'))
const pageInfo = computed(() => pageSourceInfo({
  no: studio.no(), slide: info.value, project: project.value, component: component.value,
  selectedSource: selection.value?.range ? getBlock(studio.content(), selection.value.range) : '',
  error: diagnostic.value,
}))
const copied = ref(false)
const copyError = ref(false)
async function copy(text: string) {
  copied.value = false
  copyError.value = false
  try { await navigator.clipboard.writeText(text); copied.value = true }
  catch { copyError.value = true }
}
</script>

<template>
  <section class="studio-section studio-source-panel">
    <h3 class="studio-section__title">{{ t('sourceCurrentPage') }}</h3>
    <code class="studio-source-path">{{ page.file ? location : t('sourceUnknownLocation') }}</code>
    <div class="studio-button-row">
      <button class="studio-button" :disabled="!page.markdown" @click="copy(page.markdown)">{{ t('sourceCopyMarkdown') }}</button>
      <button class="studio-button" :disabled="!page.file" @click="copy(location)">{{ t('sourceCopyLocation') }}</button>
    </div>
    <p v-if="copied" class="studio-copy-feedback" role="status">{{ t('sourceCopied') }}</p>
    <p v-if="copyError" class="studio-copy-feedback" role="alert">{{ t('sourceCopyFailed') }}</p>
    <textarea class="studio-source-code studio-source-code--page" readonly spellcheck="false" wrap="off" :value="page.markdown" :aria-label="t('sourceCurrentPage')" />
  </section>
  <section v-if="component" class="studio-section studio-source-panel">
    <h3 class="studio-section__title">{{ t('sourceComponentDefinition', { name: component.name }) }}</h3>
    <VueSource v-if="component.loadSource" :key="component.file" :load="component.loadSource" @copy="copy" />
    <p class="studio-hint">{{ t(component.source === 'project' ? 'sourceProjectComponent' : 'sourceDependencyComponent') }}</p>
    <code class="studio-source-path">{{ component.file }}</code>
    <button class="studio-button" @click="copy(component.file)">{{ t('sourceCopyPath') }}</button>
  </section>
  <section class="studio-section studio-source-panel">
    <h3 class="studio-section__title">{{ t('projectInfo') }}</h3>
    <p v-if="loading" role="status">{{ t('projectLoading') }}</p>
    <p v-if="projectError" role="alert">{{ projectError }}</p>
    <p v-if="project"><strong>{{ t('projectLocation') }}</strong><code class="studio-source-path">{{ project.root }}</code></p>
    <button class="studio-button" :disabled="loading || busy || editing || !page.file || !project" @click="copy(pageInfo)">{{ t('sourceCopyPageInfo') }}</button>
  </section>
  <section v-if="diagnostic" class="studio-section studio-source-panel">
    <h3 class="studio-section__title">{{ t('sourceRecentError') }}</h3>
    <pre class="studio-source-diagnostic">{{ diagnostic }}</pre>
  </section>
  <section class="studio-section studio-source-panel">
    <details>
      <summary>{{ t('sourceProjectScripts', { count: scripts.length }) }}</summary>
      <p class="studio-hint">{{ t('sourceScriptsHint') }}</p>
      <ul class="studio-source-scripts"><li v-for="file in scripts" :key="file"><code>{{ file }}</code></li></ul>
    </details>
    <details>
      <summary>{{ t('sourcePageInfoPreview') }}</summary>
      <textarea class="studio-source-code" readonly spellcheck="false" wrap="off" :value="pageInfo" :aria-label="t('sourcePageInfoPreview')" />
    </details>
  </section>
</template>
