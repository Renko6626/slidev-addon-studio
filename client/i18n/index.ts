import type { StudioTarget } from '../types'
import { useLocalStorage } from '@vueuse/core'
import { watch } from 'vue'
import { createI18n } from 'vue-i18n'
import en from './en'
import zhCN from './zh-CN'

export type StudioLocale = 'en' | 'zh-CN'
export type MessageKey = keyof typeof en

function browserLocale(): StudioLocale {
  return typeof navigator !== 'undefined' && navigator.language.toLowerCase().startsWith('zh') ? 'zh-CN' : 'en'
}

export const studioLocale = useLocalStorage<StudioLocale>('slidev-studio:locale', browserLocale())
if (studioLocale.value !== 'en' && studioLocale.value !== 'zh-CN')
  studioLocale.value = browserLocale()

// Studio shares a Vue app with the presentation. Use our own Composer directly
// so a deck's app.use(i18n), $t and language settings remain its own.
export const studioI18n = createI18n({
  legacy: false,
  globalInjection: false,
  locale: studioLocale.value,
  fallbackLocale: 'en',
  messages: { en, 'zh-CN': zhCN },
})

watch(studioLocale, value => (studioI18n.global.locale.value = value), { flush: 'sync' })
export const t = studioI18n.global.t

/** Keep history descriptions translatable after the language is changed. */
export interface ActionLabel {
  key: MessageKey
  params?: Record<string, string | number | { key: MessageKey }>
}

export function action(key: MessageKey, params?: ActionLabel['params']): ActionLabel {
  return { key, params }
}

export function actionText(label: ActionLabel): string {
  const params = Object.fromEntries(Object.entries(label.params ?? {}).map(([name, value]) =>
    [name, typeof value === 'object' ? t(value.key) : value],
  ))
  return t(label.key, params)
}

/** Names supplied by the deck (tags, prop keys) stay exactly as authored. */
export function targetName(target: StudioTarget): string | { key: MessageKey } {
  if (target.element)
    return { key: target.element === 'text' ? 'textBox' : 'picture' }
  if (target.tag || target.prop || target.kind === 'heading')
    return target.label
  const keys: Partial<Record<StudioTarget['kind'], MessageKey>> = {
    paragraph: 'kindText', list: 'kindList', 'list-item': 'kindListItem',
    quote: 'kindQuote', table: 'kindTable', rule: 'kindDivider', code: 'kindCode',
  }
  const key = keys[target.kind]
  return key ? { key } : target.label
}

export function targetLabel(target: StudioTarget): string {
  const name = targetName(target)
  return typeof name === 'string' ? name : t(name.key)
}
