// @vitest-environment jsdom
import { resolve } from 'node:path'
import { afterEach, expect, it, vi } from 'vitest'
import { createApp, h, nextTick, reactive, ref } from 'vue'
import { loadVueComponent } from './sfc'

const cleanups: (() => void)[] = []
afterEach(() => { cleanups.splice(0).forEach(stop => stop()); vi.restoreAllMocks(); document.body.replaceChildren() })

async function mount(props: Record<string, unknown> = {}, initiallyActive = false) {
  const active = ref(initiallyActive)
  const component = loadVueComponent(resolve('components/StudioMedia.vue'), {
    '../runtime': { useStudioContext: () => ({ active }) },
  })
  const play = vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined)
  const pause = vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {})
  const values = reactive({ src: '/opening.mp4', ...props })
  const app = createApp({ render: () => h(component, values) })
  const root = document.createElement('div'); document.body.append(root); app.mount(root)
  cleanups.push(() => app.unmount())
  await nextTick()
  const media = root.querySelector('audio,video') as HTMLMediaElement
  Object.defineProperty(media, 'readyState', { configurable: true, get: () => 1 })
  return { active, media, root, play, pause, values }
}

it('autoplays when mounted directly on an already active presentation slide', async () => {
  const s = await mount({ autoplay: true }, true)
  expect(s.play).toHaveBeenCalledOnce()
  expect(s.media.controls).toBe(true)
})

it('keeps editor media silent, starts on the active slide, and pauses and resets when leaving', async () => {
  const s = await mount({ autoplay: true, startTime: 3, volume: 0.4 })
  expect(s.play).not.toHaveBeenCalled()
  expect(s.media.controls).toBe(false)
  s.active.value = true
  await nextTick()
  expect(s.media.controls).toBe(true)
  expect(s.media.volume).toBe(0.4)
  expect(s.media.currentTime).toBe(3)
  expect(s.play).toHaveBeenCalledOnce()
  s.media.currentTime = 12
  s.active.value = false
  await nextTick()
  expect(s.pause).toHaveBeenCalled()
  expect(s.media.currentTime).toBe(3)
  expect(s.media.controls).toBe(false)
})

it('renders audio controls without autoplay and reports a decoding or file error', async () => {
  const s = await mount({ kind: 'audio', src: '/music.mp3', loop: true })
  expect(s.media.tagName).toBe('AUDIO')
  s.active.value = true
  await nextTick()
  expect(s.play).not.toHaveBeenCalled()
  expect(s.media.loop).toBe(true)
  s.media.dispatchEvent(new Event('error'))
  await nextTick()
  expect(s.root.querySelector('[role="alert"]')?.textContent).toMatch(/MP3/)
})

it('offers a manual start when autoplay is blocked instead of hiding the failure', async () => {
  const s = await mount({ autoplay: true, controls: false })
  s.play.mockRejectedValueOnce(new DOMException('Blocked', 'NotAllowedError'))
  s.active.value = true
  await nextTick(); await nextTick()
  const button = s.root.querySelector('button')!
  expect(button).not.toBeNull()
  button.click()
  await nextTick(); await nextTick()
  expect(s.play).toHaveBeenCalledTimes(2)
  expect(s.root.querySelector('button')).toBeNull()
})
