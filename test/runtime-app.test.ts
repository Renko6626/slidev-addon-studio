// @vitest-environment jsdom
import { createPinia, defineStore, setActivePinia } from 'pinia'
import { createApp, nextTick, onScopeDispose, ref, watch } from 'vue'
import type { App, Ref } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@slidev/client', async () => {
  const { ref } = await import('vue')
  const nav = {
    router: { currentRoute: ref({ query: {} }), isReady: vi.fn(async () => {}) },
    hasPrimarySlide: ref(true),
    currentSlideNo: ref(1),
    currentSlideRoute: ref({ no: 1 }),
    isPresenter: ref(false), isPrintMode: ref(false), isNotesViewer: ref(false), isEmbedded: ref(false),
  }
  return { useNav: () => nav }
})

import { useNav } from '@slidev/client'
import { getStudioRuntime, installStudioRuntime } from '../runtime'
import { setRuntimeEditing } from '../runtime/app'
import setupMain from '../setup/main'
import setupRoot from '../setup/root'

const apps: App[] = []
const nav = useNav()
const currentSlideNo = nav.currentSlideNo as Ref<number>
const currentSlideRoute = nav.currentSlideRoute as Ref<typeof nav.currentSlideRoute.value | undefined>

function createHost(root = false) {
  const app = createApp({ setup() { if (root) setupRoot(); return () => null } })
  setupMain({ app } as Parameters<typeof setupMain>[0])
  apps.push(app)
  return { app, runtime: getStudioRuntime(app), mount: () => app.mount(document.createElement('div')) }
}

beforeEach(() => {
  localStorage.clear()
  vi.stubGlobal('__DEV__', true)
  vi.stubGlobal('__SLIDEV_FEATURE_EDITOR__', true)
  nav.router.currentRoute.value = { query: {} }
  nav.hasPrimarySlide.value = true
  currentSlideNo.value = 1
  currentSlideRoute.value = { no: 1 } as typeof nav.currentSlideRoute.value
  for (const key of ['isPresenter', 'isPrintMode', 'isNotesViewer', 'isEmbedded'] as const) nav[key].value = false
  vi.mocked(nav.router.isReady).mockResolvedValue(undefined)
})

afterEach(() => {
  for (const app of apps.splice(0)) app.unmount()
  vi.unstubAllGlobals()
})

describe('application runtime', () => {
  it('installs once and keeps stores separate across actual apps, regardless of active Pinia', () => {
    const first = createHost()
    const second = createHost()
    first.mount(); second.mount()
    expect(installStudioRuntime(first.app)).toBe(first.runtime)
    expect(first.runtime.mode.value).toBe('edit')
    expect(first.runtime.canRunServices.value).toBe(false)
    const useCounter = defineStore('test-counter', () => ({ count: ref(0) }))
    setActivePinia(second.runtime.pinia)
    useCounter(first.runtime.pinia).count++
    expect(useCounter(first.runtime.pinia).count).toBe(1)
    expect(useCounter(second.runtime.pinia).count).toBe(0)
    expect(() => getStudioRuntime(createApp({}))).toThrow(/not installed/i)
  })

  it('reuses an installed Pinia and preserves it after app unmount', () => {
    const app = createApp({ render: () => null })
    const pinia = createPinia()
    app.use(pinia)
    const runtime = installStudioRuntime(app)
    expect(runtime.pinia).toBe(pinia)
    app.mount(document.createElement('div'))
    app.unmount()
    const useCounter = defineStore('external-counter', () => ({ count: ref(0) }))
    expect(useCounter(pinia).count).toBe(0)
    expect(runtime.canRunServices.value).toBe(false)
  })

  it('disposes stores owned by its application on unmount', () => {
    const { app, runtime, mount } = createHost()
    const disposed = vi.fn()
    const useOwnedStore = defineStore('owned-store', () => {
      onScopeDispose(disposed)
      return { count: ref(0) }
    })
    useOwnedStore(runtime.pinia)
    mount()
    app.unmount()
    apps.splice(apps.indexOf(app), 1)
    expect(disposed).toHaveBeenCalledOnce()
  })

  it.each([{ studio: '1' }, {}])('never grants services while initializing editor query/preference %j', async (query) => {
    localStorage.setItem('slidev-studio:open', 'true')
    nav.router.currentRoute.value.query = query
    let ready!: () => void
    vi.mocked(nav.router.isReady).mockReturnValue(new Promise<void>(resolve => { ready = resolve }))
    const { runtime, mount } = createHost(true)
    const reset = vi.fn()
    runtime.onReset(reset)
    const grants: boolean[] = []
    const stop = watch(runtime.canRunServices, value => grants.push(value), { flush: 'sync' })
    mount()
    expect(runtime.canRunServices.value).toBe(false)
    ready()
    await nextTick()
    expect(runtime.mode.value).toBe('edit')
    expect(grants).toEqual([])
    expect(reset).not.toHaveBeenCalled()
    stop()
  })

  it('ignores editor preferences in static builds and honors studio=0 in development', async () => {
    localStorage.setItem('slidev-studio:open', 'true')
    vi.stubGlobal('__DEV__', false)
    nav.router.currentRoute.value.query = { studio: '1' }
    const built = createHost(true)
    built.mount()
    await nextTick()
    expect(built.runtime.mode.value).toBe('run')
    expect(built.runtime.canRunServices.value).toBe(true)
    vi.stubGlobal('__DEV__', true)
    nav.router.currentRoute.value.query = { studio: '0' }
    const development = createHost(true)
    development.mount()
    await nextTick()
    expect(development.runtime.mode.value).toBe('run')
    expect(development.runtime.canRunServices.value).toBe(true)
  })

  it.each(['isPresenter', 'isPrintMode', 'isNotesViewer', 'isEmbedded'] as const)('revokes services synchronously in %s', async (flag) => {
    const { runtime, mount } = createHost(true)
    mount()
    await nextTick()
    expect(runtime.canRunServices.value).toBe(true)
    nav[flag].value = true
    expect(runtime.canRunServices.value).toBe(false)
    nav[flag].value = false
    expect(runtime.canRunServices.value).toBe(true)
  })

  it('requires a valid primary slide and clears qualification when the app unmounts', async () => {
    const { app, runtime, mount } = createHost(true)
    mount()
    await nextTick()
    nav.hasPrimarySlide.value = false
    expect(runtime.canRunServices.value).toBe(false)
    nav.hasPrimarySlide.value = true
    currentSlideRoute.value = undefined
    expect(runtime.canRunServices.value).toBe(false)
    currentSlideRoute.value = { no: 1 } as typeof nav.currentSlideRoute.value
    expect(runtime.canRunServices.value).toBe(true)
    app.unmount()
    apps.splice(apps.indexOf(app), 1)
    expect(runtime.canRunServices.value).toBe(false)
  })

  it('resets only at edit/run boundaries or on explicit request, with callback cleanup', async () => {
    const { app, runtime, mount } = createHost(true)
    const reset = vi.fn()
    const remove = runtime.onReset(reset)
    mount()
    await nextTick()
    expect(reset).not.toHaveBeenCalled()
    setRuntimeEditing(runtime, false)
    expect(reset).not.toHaveBeenCalled()
    setRuntimeEditing(runtime, true)
    expect(runtime.canRunServices.value).toBe(false)
    expect(reset).toHaveBeenCalledTimes(1)
    setRuntimeEditing(runtime, false)
    expect(reset).toHaveBeenCalledTimes(2)
    runtime.resetTrial()
    expect(reset).toHaveBeenCalledTimes(3)
    remove()
    runtime.resetTrial()
    expect(reset).toHaveBeenCalledTimes(3)
    runtime.onReset(reset)
    app.unmount()
    apps.splice(apps.indexOf(app), 1)
    runtime.resetTrial()
    expect(reset).toHaveBeenCalledTimes(3)
  })

  it('does not finish initialization after its root has unmounted', async () => {
    let ready!: () => void
    vi.mocked(nav.router.isReady).mockReturnValue(new Promise<void>(resolve => { ready = resolve }))
    const { app, runtime, mount } = createHost(true)
    mount()
    app.unmount()
    apps.splice(apps.indexOf(app), 1)
    ready()
    await nextTick()
    expect(runtime.canRunServices.value).toBe(false)
  })
})
