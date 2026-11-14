import type { SourceRange, StudioAsset } from '../types'
import { ref, shallowRef } from 'vue'
import { useStudio } from '../context'
import { action, t } from '../i18n'
import { appendElement, createImageElement, patchElementAttribute, readElement } from '../md/elements'
import { getBlock } from '../md/lines'
import { activePanel, busy, editing, inspectorVisible, library, reportError, selection } from '../state'
import { assetApi, readAsBase64 } from './useDeckApi'

interface ImageRequest { no: number, replace?: { range: SourceRange, source: string } }
export const imageLibraryRequest = shallowRef<ImageRequest | null>(null)
export const imagePending = ref(false)

export function useImageInsertion() {
  const studio = useStudio()
  function capture(replace: boolean): ImageRequest | null {
    if (busy.value || editing.value || imagePending.value) return null
    const range = selection.value?.range
    if (replace && (!range || readElement(studio.content(), range)?.kind !== 'image')) return null
    return { no: studio.no(), ...(replace && range ? { replace: { range: [...range], source: getBlock(studio.content(), range) } } : {}) }
  }
  function dimensions(url: string): Promise<{ width: number, height: number }> {
    return new Promise((resolve, reject) => {
      const image = new Image()
      image.onload = () => image.naturalWidth && image.naturalHeight
        ? resolve({ width: image.naturalWidth, height: image.naturalHeight })
        : reject(new Error(t('imageLoadFailed')))
      image.onerror = () => reject(new Error(t('imageLoadFailed')))
      image.src = `${import.meta.env.BASE_URL.replace(/\/$/, '')}${url}`
    })
  }
  async function place(asset: StudioAsset, request: ImageRequest) {
    const natural = await dimensions(asset.url)
    if (studio.no() !== request.no)
      throw new Error(t('imagePageChanged'))
    let range: SourceRange
    let next: string
    if (request.replace) {
      range = request.replace.range
      if (getBlock(studio.content(), range) !== request.replace.source)
        throw new Error(t('imageTargetChanged'))
      next = patchElementAttribute(studio.content(), range, 'src', asset.url)
    }
    else {
      const inserted = appendElement(studio.content(), createImageElement({ width: studio.canvas.slideWidth.value, height: studio.canvas.slideHeight.value }, natural, asset.url, asset.name.replace(/\.[^.]+$/, '')))
      next = inserted.content
      range = inserted.range
    }
    await studio.commit(next, action(request.replace ? 'actionReplaceImage' : 'actionInsert', request.replace ? undefined : { name: asset.name }))
    if (studio.no() !== request.no) return
    if (!await studio.selectInserted('img', range)) return
    library.value = null
    imageLibraryRequest.value = null
    activePanel.value = 'inspect'
    inspectorVisible.value = true
  }
  async function chooseAsset(asset: StudioAsset) {
    const request = imageLibraryRequest.value ?? capture(false)
    if (!request || imagePending.value || asset.kind !== 'image') return
    imagePending.value = true
    try { await place(asset, request) }
    catch (error) { reportError(error) }
    finally { imagePending.value = false }
  }
  function fromFile(replace = false) {
    const request = capture(replace)
    if (!request) return
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.png,.jpg,.jpeg,.gif,.svg,.webp,.avif'
    input.hidden = true
    input.addEventListener('cancel', () => input.remove(), { once: true })
    input.addEventListener('change', async () => {
      const file = input.files?.[0]
      input.remove()
      if (!file) return
      imagePending.value = true
      try {
        const asset = await assetApi.upload(file.name, await readAsBase64(file))
        if (asset) await place(asset, request)
      }
      catch (error) { reportError(error) }
      finally { imagePending.value = false }
    }, { once: true })
    document.body.append(input)
    input.click()
  }
  function fromLibrary(replace = false) {
    const request = capture(replace)
    if (!request) return
    imageLibraryRequest.value = request
    library.value = 'assets'
  }
  return { fromFile, fromLibrary, chooseAsset }
}
