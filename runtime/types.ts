import type { Pinia } from 'pinia'
import type { Ref } from 'vue'

export type StudioMode = 'edit' | 'run'
export type StudioView = 'slide' | 'global' | 'preview' | 'presenter' | 'print'

export interface StudioRuntime {
  readonly pinia: Pinia
  readonly mode: Readonly<Ref<StudioMode>>
  readonly canRunServices: Readonly<Ref<boolean>>
  resetTrial(): void
  onReset(callback: () => void): () => void
}

export interface StudioContext {
  readonly runtime: StudioRuntime
  readonly view: Readonly<Ref<StudioView>>
  readonly page: Readonly<Ref<number | null>>
  readonly active: Readonly<Ref<boolean>>
}
