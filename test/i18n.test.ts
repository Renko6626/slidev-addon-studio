import { afterEach, describe, expect, it } from 'vitest'
import { computed } from 'vue'
import { action, actionText, studioLocale, t } from '../client/i18n'
import { catalogOptionLabel, catalogPropLabel } from '../client/i18n/catalog'

afterEach(() => (studioLocale.value = 'en'))

describe('Studio language', () => {
  it('updates an existing reactive label when the selected language changes', () => {
    studioLocale.value = 'en'
    const label = computed(() => t('element'))
    expect(label.value).toBe('Element')
    studioLocale.value = 'zh-CN'
    expect(label.value).toBe('元素')
  })

  it('preserves component names when interpolating translated messages', () => {
    studioLocale.value = 'zh-CN'
    expect(t('componentProps', { name: '<Badge>' })).toBe('<Badge> 属性')
  })

  it('translates an existing history description in the newly selected language', () => {
    const label = action('actionInsert', { name: { key: 'blockText' } })
    studioLocale.value = 'en'
    expect(actionText(label)).toBe('Insert Text')
    studioLocale.value = 'zh-CN'
    expect(actionText(label)).toBe('插入 文本')
  })

  it('localizes Studio builtin labels while preserving author-provided metadata', () => {
    studioLocale.value = 'zh-CN'
    const prop = { name: 'autoplay', label: 'Autoplay' }
    const builtin = { name: 'SlidevVideo', source: 'builtin' as const }
    expect(catalogPropLabel(builtin, prop)).toBe('自动播放')
    expect(catalogOptionLabel(builtin, prop, 'once')).toBe('仅一次')
    expect(catalogPropLabel({ ...builtin, source: 'project' }, prop)).toBe('Autoplay')
    expect(catalogOptionLabel({ ...builtin, source: 'project' }, prop, 'once')).toBe('once')
    expect(catalogPropLabel(builtin, { ...prop, label: 'Custom label' })).toBe('Custom label')
  })
})
