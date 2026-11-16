import type { ResolvedSlidevOptions } from '@slidev/types'
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { buildCatalog, parseProps, shapeOf } from '../node/catalog'

async function catalogFromFiles(files: Record<string, string>) {
  const root = await mkdtemp(join(tmpdir(), 'studio-authored-snippets-'))
  try {
    await mkdir(join(root, 'components'))
    for (const [name, source] of Object.entries(files))
      await writeFile(join(root, 'components', `${name}.vue`), source)
    return await buildCatalog({
      clientRoot: join(root, 'client'), userRoot: root, themeRoots: [], addonRoots: [],
      data: { config: {} }, utils: { getLayouts: async () => ({}) },
    } as unknown as ResolvedSlidevOptions)
  }
  finally {
    await rm(root, { recursive: true, force: true })
  }
}

describe('authored catalog markup', () => {
  const hiddenBadge = '<template><span>Badge</span></template>\n<studio lang="yaml">\nhidden: true\n</studio>'

  it('preserves a declared snippet and its inherited preview when a child is hidden from the palette', async () => {
    const snippet = '<Demo><PrivateBadge>Label</PrivateBadge></Demo>'
    const catalog = await catalogFromFiles({
      Demo: `<template><div><slot /></div></template>\n<studio lang="yaml">\nsnippet: '${snippet}'\n</studio>`,
      PrivateBadge: hiddenBadge,
    })
    expect(catalog.components.filter(component => !component.hidden).map(component => component.name)).toEqual(['Demo'])
    expect(catalog.components[0].snippet).toBe(snippet)
    expect(catalog.components[0].preview).toBe(snippet)
  })

  it('preserves a declared preview while repairing placeholders in its inferred insertion example', async () => {
    const preview = '<Demo><PrivateBadge /></Demo>'
    const catalog = await catalogFromFiles({
      Demo: `<!--\n<Demo><YourElements /></Demo>\n-->\n<template><div><slot /></div></template>\n<studio lang="yaml">\npreview: '${preview}'\n</studio>`,
      PrivateBadge: hiddenBadge,
    })
    expect(catalog.components[0].snippet).toBe('<Demo>Your elements</Demo>')
    expect(catalog.components[0].preview).toBe(preview)
  })
})

/**
 * The catalog reads a component's own source to build the inspector, so these
 * cover the TypeScript shapes a real component is written in rather than the
 * tidy ones.
 */
describe('parseProps', () => {
  it('keeps a generic type whole', () => {
    const code = `
      <script setup lang="ts">
      defineProps<{
        entries: Record<string, string>
        tally: Map<string, number>
        label: string
      }>()
      </script>
    `
    const props = parseProps(code)
    expect(props.map(p => p.name)).toEqual(['entries', 'tally', 'label'])
    expect(props.find(p => p.name === 'entries')?.type).toBe('Record<string, string>')
    expect(props.find(p => p.name === 'tally')?.type).toBe('Map<string, number>')
  })

  it('reads every default, even past one that returns an object', () => {
    const code = `
      <script setup lang="ts">
      withDefaults(defineProps<{
        config?: { theme: string }
        label?: string
        dense?: boolean
      }>(), {
        config: () => ({ theme: 'dark' }),
        label: 'Hei',
        dense: true,
      })
      </script>
    `
    const props = parseProps(code)
    expect(props.find(p => p.name === 'label')?.default).toBe('Hei')
    // A boolean that defaults to true decides whether "No" writes `:x="false"`
    // or removes the attribute, so losing it changes what the editor writes.
    expect(props.find(p => p.name === 'dense')?.default).toBe('true')
  })

  it('reads the row fields of an array of records', () => {
    const code = `
      <script setup lang="ts">
      defineProps<{
        items: { year: string, text: string, highlight?: boolean }[]
      }>()
      </script>
    `
    const [items] = parseProps(code)
    expect(shapeOf(items, code)?.map(f => f.name)).toEqual(['year', 'text', 'highlight'])
  })
})


it('keeps hidden component metadata and exposes only declared fields', async () => {
  const catalog = await catalogFromFiles({ Card: `<script setup lang="ts">
withDefaults(defineProps<{ contentHtml?: string; secret?: string; imageSrc?: string }>(), {
  contentHtml: '<p>Default</p>', secret: 'internal', imageSrc: '',
})
</script>
<template><div /></template>
<studio lang="yaml">
hidden: true
propsMode: declared
props:
  contentHtml:
    control: richtext
    label: Content
  imageSrc:
    control: image
</studio>` })
  expect(catalog.components[0]).toMatchObject({ hidden: true, propsMode: 'declared' })
  expect(catalog.components[0].props.map(prop => prop.name)).toEqual(['contentHtml', 'imageSrc'])
  expect(catalog.components[0].props[0]).toMatchObject({ control: 'richtext', label: 'Content', defaultLiteral: "'<p>Default</p>'" })
})
