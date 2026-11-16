import type { ComponentEntry, LayoutEntry } from '../shared/catalog'

export type { PropControl, PropField, PropMeta, PropOption } from '../shared/catalog'

/** A line range inside a slide's Markdown content: `[start, end)`, zero-based. */
export type SourceRange = [start: number, end: number]

export type TargetKind =
  | 'heading'
  | 'paragraph'
  | 'list'
  | 'list-item'
  | 'quote'
  | 'table'
  | 'rule'
  | 'html'
  | 'component'
  | 'code'
  | 'frontmatter'
  | 'unknown'

export interface StudioTarget {
  /** Only explicitly marked, editor-created basic elements get dedicated controls. */
  element?: 'text' | 'image' | 'shape'
  /** The rendered element the user picked. */
  el: HTMLElement
  /** Slide this element belongs to. */
  no: number
  /** Where it lives in the slide's Markdown, once resolved against the source. */
  range: SourceRange | null
  kind: TargetKind
  /** Tag name for html/component targets. */
  tag?: string
  /**
   * The frontmatter key this element renders, for text a layout was given
   * rather than text the slide holds. Such an element has no `range`: its words
   * live in the slide's frontmatter, and that is where an edit is written.
   */
  prop?: string
  /** True when the block is wrapped in, or carries, a `v-drag` position. */
  positioned: boolean
  /**
   * The element shares its Markdown block with siblings, so actions that move
   * or duplicate whole blocks do not apply to it.
   */
  nested: boolean
  /** Short human label for the UI. */
  label: string
}

/** Free position of a `v-drag` element, in slide canvas units. */
export interface DragPos {
  x: number
  y: number
  w: number
  /** `null` means "auto height", which `v-drag` writes as `_` or `NaN`. */
  h: number | null
  rotate: number
}

export interface ClickConfig {
  /** `undefined` = always visible. */
  at?: number | [number, number]
  hide?: boolean
  /** Children revealed one by one, i.e. a `<v-clicks>` wrapper. */
  stagger?: boolean
  /** Motion preset id, or `undefined` for none. */
  motion?: string
}

/** Catalog data with the browser-only component loader. */
export interface CatalogComponent extends ComponentEntry {
  load?: () => Promise<any>
}

/** Catalog data with the browser-only layout loader. */
export interface CatalogLayout extends LayoutEntry {
  load?: () => Promise<any>
}

export interface StudioAsset {
  url: string
  name: string
  size: number
  kind: 'image' | 'video'
}
