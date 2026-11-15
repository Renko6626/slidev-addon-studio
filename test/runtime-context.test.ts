// @vitest-environment jsdom
import { resolve } from 'node:path'
import { defineStore } from 'pinia'
import { inject, createApp, defineComponent, h, nextTick, onScopeDispose, provide, ref } from 'vue'
import type { App, Component, Ref } from 'vue'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { injectionCurrentPage, injectionRenderContext } from '@slidev/client/constants.ts'
import type { RenderContext } from '@slidev/types'
import { getStudioRuntime, installStudioRuntime, useStudioContext } from '../runtime'
import type { StudioContext, StudioRuntime } from '../runtime'
import { initializeRuntime, setRuntimeEditing } from '../runtime/app'
import * as previewRuntime from '../runtime/preview'
import { loadVueComponent } from './sfc'

const host = vi.hoisted(() => ({ nav: null as any, readSlide: vi.fn() }))
vi.mock('@slidev/client', () => ({ useNav: () => host.nav, useSlideContext: () => host.readSlide() }))

const apps: App[] = []
const contexts: StudioContext[] = []
const disposed: StudioRuntime[] = []
const useCounter = defineStore('context-counter', () => {
  const count = ref(0)
  const runtime = contexts.at(-1)!.runtime
  onScopeDispose(() => disposed.push(runtime))
  return { count }
})
const Counter = defineComponent({
  setup() {
    const context = useStudioContext()
    contexts.push(context)
    const store = useCounter(context.runtime.pinia)
    return () => h('span', { class: 'count' }, String(store.count))
  },
})

function mount(render: () => unknown) {
  const container = document.createElement('div')
  document.body.append(container)
  const app = createApp({ render })
  const runtime = installStudioRuntime(app)
  initializeRuntime(runtime, { editing: false, canRunServices: true })
  apps.push(app)
  app.mount(container)
  return { app, runtime, container }
}
function page(no: Ref<number>, renderContext: Ref<RenderContext>, children: Component[]) {
  return defineComponent({
    setup() {
      provide(injectionCurrentPage, no)
      provide(injectionRenderContext, renderContext)
      return () => children.map(child => h(child))
    },
  })
}
const paint = { useDeckPaint: () => ref({}) }
const ComponentPreview = loadVueComponent(resolve(process.cwd(), 'client/ui/parts/ComponentPreview.vue'), {
  '../../../runtime/preview': previewRuntime,
  '../../composables/useDeckPaint': paint,
})
const env = { configs: { selectable: true }, slideWidth: ref(980), slideHeight: ref(552) }
const SlideWrapper = loadVueComponent(resolve(process.cwd(), 'node_modules/@slidev/client/internals/SlideWrapper.vue'), {
  '@vueuse/core': { provideLocal: provide },
  '#slidev/global-layers': { SlideBottom: { render: () => null }, SlideTop: { render: () => null } },
  '../constants': { injectionCurrentPage, injectionRenderContext, injectionRoute: 'route', injectionFrontmatter: 'frontmatter', injectionClicksContext: 'clicks', injectionSlideZoom: 'zoom' },
  '../env': env,
  '../utils': { getSlideClass: () => '' },
})
const SlideThumbnail = loadVueComponent(resolve(process.cwd(), 'client/ui/parts/SlideThumbnail.vue'), {
  '../../../runtime/preview': previewRuntime,
  '@slidev/client/env.ts': env,
  '@slidev/client/composables/useClicks.ts': { createFixedClicks: () => ({}) },
  '@slidev/client/internals/SlideWrapper.vue': { default: SlideWrapper },
  '../../composables/useDeckPaint': paint,
})

beforeEach(() => {
  contexts.length = 0
  disposed.length = 0
  host.nav = {
    currentSlideNo: ref(1), currentSlideRoute: ref({ no: 1 }), hasPrimarySlide: ref(true),
    isPrintMode: ref(false), isNotesViewer: ref(false), isPresenter: ref(false), isEmbedded: ref(false),
  }
  host.readSlide.mockReset().mockImplementation(() => {
    const $page = inject(injectionCurrentPage), $renderContext = inject(injectionRenderContext)
    if (!$page || !$renderContext) throw new Error('SlideWrapper context is missing')
    return { $page, $renderContext }
  })
})
afterEach(() => {
  apps.splice(0).forEach(app => app.unmount())
  document.body.replaceChildren()
})

it('shares main stores between siblings and reacts to active page, edit mode and auxiliary views', () => {
  const renderContext = ref<RenderContext>('slide')
  const first = page(ref(1), renderContext, [Counter, Counter])
  const second = page(ref(2), ref('slide'), [Counter])
  const { runtime } = mount(() => [h(first), h(second)])
  expect(contexts.map(context => context.active.value)).toEqual([true, true, false])
  expect(contexts[0].runtime).toBe(runtime)
  useCounter(contexts[0].runtime.pinia).count = 4
  expect(useCounter(contexts[1].runtime.pinia).count).toBe(4)
  host.nav.currentSlideNo.value = 2
  host.nav.currentSlideRoute.value = { no: 2 }
  expect(contexts.map(context => context.active.value)).toEqual([false, false, true])
  setRuntimeEditing(runtime, true)
  expect(contexts[2].active.value).toBe(false)
  setRuntimeEditing(runtime, false)
  for (const flag of ['isPrintMode', 'isNotesViewer', 'isPresenter', 'isEmbedded']) {
    host.nav[flag].value = true
    expect(contexts.every(context => !context.active.value)).toBe(true)
    host.nav[flag].value = false
  }
  renderContext.value = 'presenter'
  expect(contexts[0].view.value).toBe('presenter')
  host.nav.isPrintMode.value = true
  expect(contexts[0].view.value).toBe('print')
  host.nav.isPrintMode.value = false
  renderContext.value = 'previewNext'
  expect(contexts[0].view.value).toBe('preview')
})

it('recognizes global layers, including the app-level page injection, without requiring SlideWrapper', () => {
  const Global = page(ref(1), ref('none'), [Counter])
  mount(() => [h(Counter), h(Global)])
  expect(contexts.map(context => [context.view.value, context.page.value, context.active.value])).toEqual([
    ['global', null, false], ['global', null, false],
  ])
  expect(host.readSlide).not.toHaveBeenCalled()
})

it('isolates two real component palette previews without SlideWrapper and disposes their stores on removal', async () => {
  const shown = ref(true)
  const component = { name: 'Counter', preview: '<Counter />', previewable: true, load: async () => ({ default: Counter }) }
  const { runtime, container } = mount(() => [h(Counter), ...(shown.value ? [h(ComponentPreview, { component }), h(ComponentPreview, { component })] : [])])
  await nextTick(); await nextTick()
  expect(container.querySelectorAll('.count')).toHaveLength(3)
  const [main, first, second] = contexts
  expect(new Set(contexts.map(context => context.runtime.pinia)).size).toBe(3)
  expect(main.runtime).toBe(runtime)
  expect([first, second].map(context => [context.view.value, context.page.value, context.active.value, context.runtime.canRunServices.value])).toEqual([
    ['preview', null, false, false], ['preview', null, false, false],
  ])
  useCounter(first.runtime.pinia).count = 7
  expect(useCounter(second.runtime.pinia).count).toBe(0)
  expect(useCounter(runtime.pinia).count).toBe(0)
  shown.value = false
  await nextTick()
  expect(disposed).toEqual(expect.arrayContaining([first.runtime, second.runtime]))
  expect(disposed.includes(runtime)).toBe(false)
  expect(getStudioRuntime(apps[0])).toBe(runtime)
  expect(host.readSlide).not.toHaveBeenCalled()
})

it('overrides the real thumbnail SlideWrapper and releases component resources on unmount', async () => {
  const shown = ref(true), clean = vi.fn()
  const Effect = defineComponent({ setup() {
    onScopeDispose(clean)
    return () => h(Counter)
  } })
  const route = { no: 1, meta: { slide: { frontmatter: {} } }, component: Effect }
  mount(() => shown.value ? h(SlideThumbnail, { route }) : null)
  expect(contexts).toHaveLength(1)
  expect(contexts[0].view.value).toBe('preview')
  expect(contexts[0].page.value).toBe(null)
  expect(contexts[0].active.value).toBe(false)
  expect(host.readSlide).not.toHaveBeenCalled()
  shown.value = false
  await nextTick()
  expect(clean).toHaveBeenCalledOnce()
  expect(disposed).toHaveLength(1)
})
