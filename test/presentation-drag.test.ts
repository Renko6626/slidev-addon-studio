// @vitest-environment jsdom
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import ts from 'typescript'
import * as Vue from 'vue'
import * as VueUse from '@vueuse/core'
import type { App, Component } from 'vue'
import { afterEach, expect, it, vi } from 'vitest'
import { presentationDragPlugin } from '../node/presentation-drag'
import vitePlugins from '../setup/vite-plugins'
import { loadVueComponent } from './sfc'

const require = createRequire(import.meta.url)
const target = require.resolve('@slidev/client/composables/useDragElements.ts')
const client = dirname(dirname(target))
const slidevRequire = createRequire(target)
const antfu = await import(slidevRequire.resolve('@antfu/utils'))
const parser = await import(slidevRequire.resolve('@slidev/parser/core'))
const original = readFileSync(target, 'utf8')

// Compile the installed modules; only environment-bound dependencies are supplied.
function loadModule(code: string, modules: Record<string, unknown>, dev = true): any {
  const script = ts.transpileModule(code.replaceAll('import.meta.env.BASE_URL', JSON.stringify(import.meta.env.BASE_URL)), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ESNext } }).outputText
  const exports = {}
  new Function('require', 'exports', '__DEV__', '__SLIDEV_FEATURE_EDITOR__', script)((name: string) => {
    if (!(name in modules)) throw new Error(`Unexpected Slidev import ${name}`)
    return modules[name]
  }, exports, dev, dev)
  return exports
}
const constants = loadModule(readFileSync(join(client, 'constants.ts'), 'utf8'), {})
const utils = loadModule(readFileSync(join(client, 'utils.ts'), 'utf8'), { './env': { configs: {} } })
const logicUtils = loadModule(readFileSync(join(client, 'logic/utils.ts'), 'utf8'), { '@slidev/parser/core': parser })

async function transform(code = original, id = target, plugin = presentationDragPlugin(client)) {
  const hook = plugin.transform!
  const handler = typeof hook === 'function' ? hook : hook.handler
  return await (handler as Function).call({ error(message: string) { throw new Error(message) } }, code, id)
}
const apps: App[] = []
afterEach(() => {
  apps.splice(0).forEach(app => app.unmount())
  document.body.replaceChildren()
  vi.useRealTimers()
})

async function mountDrag(dev: boolean, context: 'slide' | 'presenter', code: string) {
  const activeDragElement = Vue.shallowRef(null)
  const info = Vue.ref({ content: '<div />', frontmatter: {} })
  const update = vi.fn()
  const drag = loadModule(code, {
    vue: Vue, '@vueuse/core': VueUse, '@antfu/utils': antfu,
    '../constants': constants, '../logic/utils': logicUtils, '../utils': utils,
    '../state': { activeDragElement },
    './useNav': { useNav: () => ({ isPrintMode: Vue.ref(false) }) },
    './useSlideBounds': { useSlideBounds: () => ({ left: Vue.ref(0), top: Vue.ref(0), stop: () => {} }) },
    './useSlideInfo': { useDynamicSlideInfo: () => ({ info, update }) },
  }, dev)
  const directive = loadModule(readFileSync(join(client, 'modules/v-drag.ts'), 'utf8'), {
    vue: Vue, '../composables/useDragElements': drag,
  }).createVDragDirective()
  const Arrow = loadVueComponent(join(client, 'builtin/Arrow.vue'), { '@vueuse/core': VueUse, '../logic/utils': logicUtils })
  const VDrag = loadVueComponent(join(client, 'builtin/VDrag.vue'), { '../composables/useDragElements': drag })
  const VDragArrow = loadVueComponent(join(client, 'builtin/VDragArrow.vue'), { '../composables/useDragElements': drag, './Arrow.vue': { default: Arrow } })
  const clicks = vi.fn(), doubleClicks = vi.fn()
  const businessButton = () => Vue.h('button', { onClick: clicks, onDblclick: doubleClicks }, 'Answer')
  const app = Vue.createApp({ setup() {
    Vue.provide(constants.injectionRenderContext, Vue.ref(context))
    Vue.provide(constants.injectionFrontmatter, {})
    Vue.provide(constants.injectionCurrentPage, Vue.ref(1))
    Vue.provide(constants.injectionSlideScale, Vue.ref(1))
    Vue.provide(constants.injectionSlideZoom, Vue.ref(1))
    Vue.provide(constants.injectionSlideElement, Vue.ref(null))
    const source = { markdownSource: [0, 1, 0] }
    return () => [
      Vue.withDirectives(Vue.h('div', { ...source, class: 'directive' }, [businessButton()]), [[Vue.resolveDirective('drag')!, [10, 20, 100, 80, 30]]]),
      Vue.h(VDrag as Component, { ...source, pos: '10,20,100,80,30', class: 'component' }, businessButton),
      Vue.h(VDragArrow as Component, { ...source, pos: '10,20,100,80', class: 'arrow' }),
    ]
  } })
  app.use(directive)
  const container = document.createElement('div')
  document.body.append(container)
  apps.push(app)
  app.mount(container)
  await Vue.nextTick()
  return { container, activeDragElement, clicks, doubleClicks, info, update }
}

it.each([true, false])('keeps all native drag entries fixed and business events usable (dev=%s)', async (dev) => {
  vi.useFakeTimers()
  const result = await transform()
  const s = await mountDrag(dev, 'slide', result.code)
  const positioned = [...s.container.querySelectorAll<HTMLElement>('.directive, .component')]
  expect(positioned).toHaveLength(2)
  const line = s.container.querySelector('.arrow line')!
  expect(['x1', 'y1', 'x2', 'y2'].map(name => line.getAttribute(name))).toEqual(['10', '20', '110', '100'])
  for (const element of positioned) {
    expect([element.style.left, element.style.top, element.style.width, element.style.height, element.style.transform]).toEqual(['10px', '20px', '100px', '80px', 'rotate(30deg)'])
  }
  const before = s.container.innerHTML
  for (const element of s.container.querySelectorAll('.directive button, .component button, .arrow line, .arrow polygon')) {
    element.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    element.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }))
    expect(s.activeDragElement.value).toBeNull()
    element.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, buttons: 1, clientX: 10, clientY: 20 }))
    window.dispatchEvent(new MouseEvent('pointermove', { bubbles: true, buttons: 1, clientX: 200, clientY: 250 }))
    window.dispatchEvent(new MouseEvent('pointerup', { bubbles: true }))
  }
  await Vue.nextTick()
  await vi.advanceTimersByTimeAsync(600)
  expect(s.container.innerHTML).toBe(before)
  expect(s.clicks).toHaveBeenCalledTimes(2)
  expect(s.doubleClicks).toHaveBeenCalledTimes(2)
  expect(s.info.value).toEqual({ content: '<div />', frontmatter: {} })
  expect(s.update).not.toHaveBeenCalled()
})

it('disables the same entry in presenter context, where upstream dragging is enabled', async () => {
  const result = await transform()
  const s = await mountDrag(true, 'presenter', result.code)
  for (const element of s.container.querySelectorAll('.directive, .component, .arrow line')) {
    element.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }))
    expect(s.activeDragElement.value).toBeNull()
  }
})

it('exercises upstream activation without the adapter so the lock regression is observable', async () => {
  const s = await mountDrag(true, 'slide', original)
  for (const element of s.container.querySelectorAll('.directive, .component, .arrow line')) {
    s.activeDragElement.value = null
    element.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }))
    expect(s.activeDragElement.value).not.toBeNull()
  }
})

it.each(['serve', 'build'])('installs the transform for %s including Vite query ids', async (command) => {
  const plugins = vitePlugins({ mode: command === 'serve' ? 'dev' : 'build', clientRoot: client, roots: [], data: { config: {} } } as any)
  const plugin = plugins.find(plugin => plugin.name === 'slidev-studio-presentation-drag')!
  expect(plugin).toBeDefined()
  expect(plugin.apply).toBeUndefined()
  const result = await transform(original, `${target}?v=abc`, plugin)
  const s = await mountDrag(command === 'serve', 'slide', result.code)
  s.container.querySelector('.directive')!.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }))
  expect(s.activeDragElement.value).toBeNull()
})

it('targets the active Slidev client root and leaves other same-named modules untouched', async () => {
  const clientRoot = '/deck/slidev-client'
  const plugin = presentationDragPlugin(clientRoot)
  expect(await transform(original, target, plugin)).toBeNull()
  expect(await transform(original, '/some-other-addon/composables/useDragElements.ts', plugin)).toBeNull()
  const result = await transform(original, `${clientRoot}/composables/useDragElements.ts`, plugin)
  const s = await mountDrag(true, 'slide', result.code)
  s.container.querySelector('.directive')!.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }))
  expect(s.activeDragElement.value).toBeNull()
})

it.each([
  ['missing', original.replace('startDragging(): void', 'beginDragging(): void')],
  ['ambiguous', `${original}\nfunction startDragging(): void {}`],
  ['changed body', original.replace('activeDragElement.value = state', 'activeDragElement.value = null')],
])('reports incompatible Slidev source clearly when the method is %s', async (_reason, source) => {
  await expect(transform(source)).rejects.toThrow(`不兼容原生拖拽适配: ${target}`)
})
