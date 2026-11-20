// @vitest-environment jsdom
import { resolve } from 'node:path'
import { createApp, h, nextTick, ref } from 'vue'
import { onClickOutside } from '@vueuse/core'
import { afterEach, expect, it, vi } from 'vitest'
import * as fonts from '../client/fonts'
import * as shared from '../shared/fonts'
import { loadVueComponent } from './sfc'

const root = document.createElement('div')
const projectCSS = '@font-face{font-family:"Deck Face";src:url("./deck.woff2")}'
const picker = loadVueComponent(resolve('client/ui/parts/FontPicker.vue'), {
  '@vueuse/core': { onClickOutside },
  '../../fonts': fonts,
  '../../../shared/fonts': shared,
  '../../i18n': { t: (key: string) => key },
  '../../state': { selection: ref(null) },
  '../../composables/useDeckApi': { fontApi: { list: async () => ({ css: projectCSS }) } },
  './StudioIcon.vue': { default: { render: () => null } },
})
let app: ReturnType<typeof createApp>
async function openPicker() {
  const change = vi.fn()
  document.body.append(root)
  app = createApp({ render: () => h(picker, { value: null, placeholder: 'Font', disabled: false, onChange: change }) })
  app.mount(root)
  root.querySelector('button')!.click()
  await vi.waitFor(() => expect(document.activeElement).toBe(document.querySelector('input[type="search"]')))
  return change
}
afterEach(() => {
  app?.unmount()
  root.remove()
  document.getElementById('studio-project-fonts')?.remove()
  vi.unstubAllGlobals()
})

it('opens the font list from its name field, groups installed faces and searches their localized and PostScript names', async () => {
  const query = vi.fn().mockResolvedValue([
    { family: 'Microsoft YaHei', fullName: 'Microsoft YaHei', postscriptName: 'MicrosoftYaHei' },
    { family: 'Microsoft YaHei', fullName: 'Microsoft YaHei Bold', postscriptName: 'MicrosoftYaHei-Bold' },
  ])
  vi.stubGlobal('queryLocalFonts', query)
  const change = await openPicker()
  expect(query).toHaveBeenCalledOnce()
  const menu = document.querySelector('fieldset')!
  const search = menu.querySelector('input[type="search"]') as HTMLInputElement
  for (const name of ['微软雅黑', 'yahei-bold']) {
    search.value = name
    search.dispatchEvent(new Event('input'))
    await nextTick()
    expect(menu.querySelectorAll('.studio-font-choice')).toHaveLength(1)
  }
  search.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }))
  const choice = menu.querySelector<HTMLButtonElement>('.studio-font-choice')!
  expect(document.activeElement).toBe(choice)
  choice.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }))
  expect(document.activeElement).toBe(search)
  search.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
  expect(change.mock.calls).toEqual([['"Microsoft YaHei"']])
  await nextTick()
  expect(document.querySelector('fieldset')).toBeNull()
})

it.each(['denied', 'unavailable'])('keeps imported project fonts, file import and custom names accessible when font access is %s', async reason => {
  vi.stubGlobal('queryLocalFonts', reason === 'denied'
    ? () => Promise.reject(new DOMException('Permission denied', 'NotAllowedError')) : undefined)
  const change = await openPicker()
  const menu = document.querySelector('fieldset')!
  expect(menu.textContent).toContain('fontLocal')
  expect(menu.textContent).not.toContain('fontInstalled')
  expect(menu.textContent).toContain('Deck Face')
  expect(menu.querySelector('input[type="file"]')?.getAttribute('accept')).toBe(shared.FONT_ACCEPT)
  const search = menu.querySelector('input[type="search"]') as HTMLInputElement
  search.value = 'Agency Custom, sans-serif'
  search.dispatchEvent(new Event('input'))
  await nextTick()
  search.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
  expect(change.mock.calls).toEqual([['Agency Custom, sans-serif']])
})

it('opens the file chooser from the footer and returns from import to the same filtered list', async () => {
  vi.stubGlobal('queryLocalFonts', undefined)
  const change = await openPicker()
  const menu = document.querySelector('fieldset')!
  const search = menu.querySelector<HTMLInputElement>('input[type=search]')!
  search.value = 'Georgia'
  search.dispatchEvent(new Event('input'))
  await nextTick()
  const input = menu.querySelector<HTMLInputElement>('input[type=file]')!
  const click = vi.spyOn(input, 'click')
  menu.querySelector<HTMLButtonElement>('.font-footer button')!.click()
  expect(click).toHaveBeenCalledOnce()
  expect(menu.querySelector('form')).toBeNull()
  Object.defineProperty(input, 'files', { value: [new File(['font'], 'Georgia.ttf')] })
  input.dispatchEvent(new Event('change'))
  await nextTick()
  expect(menu.querySelector<HTMLInputElement>('form input[type=text]')?.value).toBe('Georgia')
  expect(menu.querySelector('.font-list')).toBeNull()
  menu.querySelector<HTMLButtonElement>('button[aria-label="fontHeavier"]')!.click()
  await nextTick()
  expect(menu.querySelector<HTMLInputElement>('input[type=number]')?.value).toBe('500')
  menu.querySelector<HTMLButtonElement>('.font-back')!.click()
  await nextTick()
  expect(menu.querySelector<HTMLInputElement>('input[type=search]')?.value).toBe('Georgia')
  expect(change).not.toHaveBeenCalled()
})
