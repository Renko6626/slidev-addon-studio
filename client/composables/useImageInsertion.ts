import type { PropMeta, SourceRange, StudioAsset, StudioTarget } from '../types'
import { ref, shallowRef } from 'vue'
import { useStudio } from '../context'
import { action, t } from '../i18n'
import { appendElement, createImageElement, patchElementAttribute, readElement } from '../md/elements'
import { readComponentString, writeComponentString } from '../md/component-fields'
import { getBlock } from '../md/lines'
import { changePageBackground, isFreeCanvasPage } from './usePageBackground'
import { activePanel, busy, editing, inspectorVisible, library, reportError, selection } from '../state'
import { assetApi, readAsBase64 } from './useDeckApi'
import { assetAccept } from '../../shared/assets'

interface ImageRequest { no: number, field?: { range: SourceRange, source: string, prop: PropMeta, tag?: string }, background?: boolean, replace?: { range: SourceRange, source: string } }
export const imageLibraryRequest = shallowRef<ImageRequest | null>(null)
export const imagePending = ref(false)

export function useImageInsertion() {
  const studio = useStudio()
  function capture(replace: boolean, background = false, field?: { owner: StudioTarget, prop: PropMeta }): ImageRequest | null {
    if (busy.value || editing.value || imagePending.value) return null
    if (field) {
      const { owner, prop } = field
      if (!owner.range || owner.no !== studio.no() || !readComponentString(studio.content(), owner.range, prop).editable) return null
      return { no: studio.no(), field: { range: [...owner.range], source: getBlock(studio.content(), owner.range), prop, tag: owner.tag } }
    }
    const range = selection.value?.range
    if (replace && (!range || readElement(studio.content(), range)?.kind !== 'image')) return null
    if (background && (studio.frontmatter().layout !== 'none' || !isFreeCanvasPage(studio.no(), studio.content()))) return null
    return { no: studio.no(), background, ...(replace && range ? { replace: { range: [...range], source: getBlock(studio.content(), range) } } : {}) }
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
    if (request.background) {
      if (studio.frontmatter().layout !== 'none' || !isFreeCanvasPage(studio.no(), studio.content()))
        throw new Error(t('backgroundFreeCanvasOnly'))
      await changePageBackground(studio, { kind: 'image', value: asset.url })
      library.value = null
      imageLibraryRequest.value = null
      activePanel.value = 'layout'
      inspectorVisible.value = true
      return
    }
    let range: SourceRange
    let next: string
    if (request.field) {
      range = request.field.range
      if (getBlock(studio.content(), range) !== request.field.source) throw new Error(t('imageTargetChanged'))
      next = writeComponentString(studio.content(), range, request.field.prop, asset.url)
    }
    else if (request.replace) {
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
    await studio.commit(next, action(request.replace || request.field ? 'actionReplaceImage' : 'actionInsert', request.replace || request.field ? undefined : { name: asset.name }))
    if (studio.no() !== request.no) return
    if (!await studio.selectInserted(request.field?.tag ?? 'img', range)) return
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
  function fromFile(replace = false, background = false, field?: { owner: StudioTarget, prop: PropMeta }) {
    const request = capture(replace, background, field)
    if (!request) return
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = assetAccept('image')
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
  function fromLibrary(replace = false, background = false, field?: { owner: StudioTarget, prop: PropMeta }) {
    const request = capture(replace, background, field)
    if (!request) return
    imageLibraryRequest.value = request
    library.value = 'assets'
  }
  return { forField: (owner: StudioTarget, prop: PropMeta, file: boolean) => file ? fromFile(false, false, { owner, prop }) : fromLibrary(false, false, { owner, prop }), fromFile, fromLibrary, chooseAsset, backgroundFromFile: () => fromFile(false, true), backgroundFromLibrary: () => fromLibrary(false, true) }
}
