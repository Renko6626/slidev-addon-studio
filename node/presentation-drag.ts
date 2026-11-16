import { join } from 'node:path'
import type { Plugin } from 'vite'

// This private Slidev 52.19 / 53.0 entry is shared by v-drag, VDrag and VDragArrow.
// Keep the adapter deliberately narrow: an upstream change needs review.
const START_DRAGGING = /\bstartDragging\s*\(\s*\)\s*:\s*void\s*\{\s*if\s*\(\s*!enabled\s*\)\s*return\s*updateBounds\(\s*\)\s*activeDragElement\.value\s*=\s*state\s*\}/g

export function presentationDragPlugin(clientRoot: string): Plugin {
  const target = join(clientRoot, 'composables/useDragElements.ts').replace(/\\/g, '/')
  return {
    name: 'slidev-studio-presentation-drag',
    enforce: 'pre',
    transform(code, id) {
      if (id.split('?')[0].replace(/\\/g, '/') !== target)
        return null

      if ([...code.matchAll(/\bstartDragging\b/g)].length !== 1 || [...code.matchAll(START_DRAGGING)].length !== 1)
        this.error(`[slidev-studio] 不兼容原生拖拽适配: ${target}。预期唯一的 Slidev 52.19 / 53.0 startDragging 方法，请检查安装版本。`)

      // Retain the original positioning, rendering, lifecycle and save logic.
      // Studio's own transform gizmo does not use this native entry.
      return { code: code.replace(START_DRAGGING, 'startDragging(): void {}'), map: null }
    },
  }
}
