import type { InjectionKey } from 'vue'
import { computed, provide } from 'vue'
import { createRuntimeHost } from './app'
import type { StudioContext, StudioRuntime } from './types'

// Internal editor boundary; deliberately absent from the public barrel.
export const previewContextKey: InjectionKey<StudioContext> = Symbol('studio-preview-context')
const disposals = new WeakMap<StudioRuntime, () => void>()

export function createPreviewRuntime(): StudioRuntime {
  const { runtime, dispose } = createRuntimeHost()
  disposals.set(runtime, dispose)
  return runtime
}

export function disposePreviewRuntime(runtime: StudioRuntime): void {
  disposals.get(runtime)?.()
  disposals.delete(runtime)
}

export function providePreviewRuntime(runtime: StudioRuntime): void {
  provide(previewContextKey, {
    runtime,
    view: computed(() => 'preview' as const),
    page: computed(() => null),
    active: computed(() => false),
  })
}
