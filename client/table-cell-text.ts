import type { Editor } from '@tiptap/core'
import type { TextDefaults } from './text/editor'
import { ref, shallowRef } from 'vue'

/**
 * The rich-text editor for the cell currently open on the canvas.
 *
 * `useTextEditor` exposes it as the active editor, so the existing Home-tab
 * formatting controls work without a second toolbar. `TableEditorLayer` owns
 * the lifecycle.
 */
export const tableCellEditor = shallowRef<Editor | null>(null)
export const tableCellDefaults = shallowRef<TextDefaults>({})
export const tableCellRevision = ref(0)