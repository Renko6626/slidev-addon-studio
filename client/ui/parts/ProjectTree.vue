<script setup lang="ts">
import type { ProjectFile } from '../../../shared/project'
import { t } from '../../i18n'
import StudioIcon from './StudioIcon.vue'

defineProps<{ files: ProjectFile[] }>()
</script>

<template>
  <ul class="studio-project-tree">
    <li v-for="file in files" :key="file.path">
      <details v-if="file.kind === 'directory'" open>
        <summary :title="file.path"><StudioIcon name="folder" :size="15" /><span>{{ file.name }}</span></summary>
        <ProjectTree v-if="file.children?.length" :files="file.children" />
      </details>
      <span v-else class="studio-project-tree__file" :title="file.path">
        <StudioIcon :name="file.kind === 'link' ? 'link' : 'file'" :size="15" />
        <span>{{ file.name }}</span><small v-if="file.kind === 'link'">{{ t('projectLink') }}</small>
      </span>
    </li>
  </ul>
</template>
