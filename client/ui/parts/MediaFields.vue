<script setup lang="ts">
import { ref } from 'vue'
import { assetAccept, assetKind } from '../../../shared/assets'
import { assetApi, readAsBase64 } from '../../composables/useDeckApi'
import { useStudio } from '../../context'
import { action, t } from '../../i18n'
import { readComponentString, writeComponentString } from '../../md/component-fields'
import { getBlock } from '../../md/lines'
import { busy, editing, reportError, selection } from '../../state'
const studio = useStudio()
const pending = ref(false)
const sourceProp = { name: 'src', type: 'string' as const, defaultLiteral: "''", control: 'text' as const }
const kindProp = { name: 'kind', type: 'string' as const, defaultLiteral: "'video'", control: 'text' as const }
async function replace(file: File | undefined) {
  const owner = selection.value
  if (!file || !owner?.range || busy.value || editing.value || pending.value) return
  const range = [...owner.range] as [number, number]
  const before = getBlock(studio.content(), range)
  if (!readComponentString(studio.content(), range, sourceProp).editable || !readComponentString(studio.content(), range, kindProp).editable) { reportError(t('mediaSourceExpression')); return }
  const page = studio.no()
  pending.value = true
  try {
    const kind = assetKind(file.name)
    if (kind !== 'video' && kind !== 'audio') throw new Error(t('mediaChooseFile'))
    const asset = await assetApi.upload(file.name, await readAsBase64(file))
    if (!asset) return
    if (studio.no() !== page || getBlock(studio.content(), range) !== before) throw new Error(t('imageTargetChanged'))
    let next = writeComponentString(studio.content(), range, sourceProp, asset.url)
    next = writeComponentString(next, range, kindProp, kind)
    await studio.commit(next, action('actionSet', { name: 'src' }))
  }
  catch (error) { reportError(error) }
  finally { pending.value = false }
}
</script>

<template>
  <label class="studio-button">{{ t('mediaReplace') }}<input type="file" :accept="`${assetAccept('audio')},${assetAccept('video')}`" :disabled="busy || editing || pending" hidden @change="replace(($event.target as HTMLInputElement).files?.[0]); ($event.target as HTMLInputElement).value = ''"></label>
  <p class="studio-hint">{{ t('mediaCompatibility') }}</p>
  <p class="studio-hint">{{ t('mediaPlaybackHint') }}</p>
</template>
