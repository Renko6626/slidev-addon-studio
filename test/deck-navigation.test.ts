import { computed, nextTick, ref, shallowRef } from 'vue'
import { expect, it, vi } from 'vitest'
import { useDeckActions } from '../client/composables/useDeckActions'
import { deckApi } from '../client/composables/useDeckApi'
import { busy } from '../client/state'

function route(revision: string) {
  return { meta: { slide: { revision } }, load: async () => {} }
}

const slides = shallowRef<ReturnType<typeof route>[]>([])
const source = ref({ revision: 'old' })
const current = ref(1)
vi.mock('@slidev/client', () => ({
  useNav: () => ({
    slides, total: computed(() => slides.value.length),
    go: (no: number) => { current.value = no },
  }),
}))
vi.mock('@slidev/client/composables/useSlideInfo.ts', () => ({
  useDynamicSlideInfo: () => ({ info: source }),
}))

it.each([1, 2])('opens the page inserted after %i when the new table and source agree', async (after) => {
  slides.value = [route('first'), route('old')]
  current.value = after
  source.value = { revision: 'old' }
  const saved = { ok: true as const, no: after + 1, total: 3 }
  const insert = vi.spyOn(deckApi, 'insert').mockResolvedValue(saved)
  try {
    const opening = useDeckActions().add(after, '# New')
    await nextTick()
    expect(current.value).toBe(after)
    expect(busy.value).toBe(true)

    slides.value = slides.value.toSpliced(after, 0, route('new'))
    await nextTick()
    expect(current.value).toBe(after)
    source.value = { revision: 'new' }
    await opening
    expect(current.value).toBe(after + 1)
    expect(busy.value).toBe(false)
  }
  finally { insert.mockRestore() }
})
