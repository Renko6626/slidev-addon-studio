import type { App, Ref } from 'vue'
import { createPinia, disposePinia } from 'pinia'
import type { Pinia } from 'pinia'
import { computed, readonly, ref } from 'vue'
import type { StudioMode, StudioRuntime } from './types'

interface RuntimeState {
  mode: Ref<StudioMode>
  ready: Ref<boolean>
  viewEligible: Ref<boolean>
  disposed: boolean
}

const apps = new WeakMap<App, StudioRuntime>()
const states = new WeakMap<StudioRuntime, RuntimeState>()
const disposals = new Set<() => void>()

/** One host per Vue application, reusing only that application's installed Pinia. */
export function installStudioRuntime(app: App): StudioRuntime {
  const installed = apps.get(app)
  if (installed) return installed

  const existingPinia = app.config.globalProperties.$pinia
  const { runtime, dispose } = createRuntimeHost(existingPinia, () => { apps.delete(app) })
  if (!existingPinia) app.use(runtime.pinia)
  apps.set(app, runtime)
  app.onUnmount(dispose)
  return runtime
}

/** Internal host factory shared by the application and isolated preview subtrees. */
export function createRuntimeHost(existingPinia?: Pinia, onDispose?: () => void): { runtime: StudioRuntime, dispose: () => void } {
  const pinia = existingPinia ?? createPinia()
  const state: RuntimeState = { mode: ref('edit'), ready: ref(false), viewEligible: ref(false), disposed: false }
  const resets = new Set<() => void>()
  const runtime: StudioRuntime = {
    pinia,
    mode: readonly(state.mode),
    canRunServices: computed(() => state.ready.value && state.mode.value === 'run' && state.viewEligible.value),
    resetTrial() {
      if (!state.disposed) for (const callback of resets) callback()
    },
    onReset(callback) {
      if (!state.disposed) resets.add(callback)
      return () => { resets.delete(callback) }
    },
  }
  function dispose() {
    if (state.disposed) return
    state.disposed = true
    state.ready.value = false
    resets.clear()
    if (!existingPinia) disposePinia(pinia)
    onDispose?.()
    disposals.delete(dispose)
  }
  states.set(runtime, state)
  disposals.add(dispose)
  return { runtime, dispose }
}

export function getStudioRuntime(app: App): StudioRuntime {
  const runtime = apps.get(app)
  if (!runtime) throw new Error('[slidev-studio] Studio runtime is not installed on this Vue app.')
  return runtime
}

/** Initial navigation is not a user edit/run transition. Keep services closed until it completes. */
export function initializeRuntime(runtime: StudioRuntime, initial: { editing: boolean, canRunServices: boolean }): void {
  const state = runtimeState(runtime)
  if (state.disposed) return
  state.mode.value = initial.editing ? 'edit' : 'run'
  state.viewEligible.value = initial.canRunServices
  state.ready.value = true
}

/** Internal editor bridge; intentionally absent from the public barrel. */
export function setRuntimeEditing(runtime: StudioRuntime, editing: boolean): void {
  const state = runtimeState(runtime)
  const mode = editing ? 'edit' : 'run'
  if (state.disposed || state.mode.value === mode) return
  // Revoke services before an edit reset, and finish a run reset before granting them.
  if (editing) state.mode.value = mode
  if (state.ready.value) runtime.resetTrial()
  state.mode.value = mode
}

export function setRuntimeViewEligible(runtime: StudioRuntime, eligible: boolean): void {
  const state = runtimeState(runtime)
  if (!state.disposed) state.viewEligible.value = eligible
}

function runtimeState(runtime: StudioRuntime): RuntimeState {
  const state = states.get(runtime)
  if (!state) throw new Error('[slidev-studio] Unknown Studio runtime.')
  return state
}

if (import.meta.hot) import.meta.hot.dispose(() => { for (const dispose of disposals) dispose() })
