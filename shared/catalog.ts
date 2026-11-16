/** Component metadata and catalog data shared by the dev server and editor. */

export interface PropOption {
  value: string
  /** URL of a thumbnail, when the options are backed by image files. */
  preview?: string
}

/**
 * The control the inspector should use.
 *
 * Most are inferred from the prop's type. `color` and `color[]` are not, since
 * nothing in `string` says the string is a colour, so an author declares those.
 */
export type PropControl = 'text' | 'number' | 'boolean' | 'select' | 'list' | 'color' | 'color[]' | 'object[]'

export interface PropField {
  name: string
  type?: string
}

export interface PropMeta {
  name: string
  type?: string
  /** For an array of records, the fields each row holds. */
  fields?: PropField[]
  required?: boolean
  default?: string
  /** Human label for the inspector; defaults to the prop name. */
  label?: string
  control?: PropControl
  options?: PropOption[]
  /** Write as `:prop="…"` rather than `prop="…"`. */
  bind?: boolean
  /** Keep this prop out of the inspector. */
  hidden?: boolean
}

export type ComponentSource = 'builtin' | 'theme' | 'addon' | 'project'

export interface ComponentEntry {
  name: string
  file: string
  source: ComponentSource
  /** Directory or package the component came from, used to group the palette. */
  origin: string
  description?: string
  category?: string
  /** Markup inserted into the slide when the component is picked. */
  snippet: string
  /** Markup rendered in the palette thumbnail. Empty when it cannot be shown. */
  preview: string
  props: PropMeta[]
  previewable: boolean
}

export interface LayoutEntry {
  name: string
  file: string
  source: ComponentSource
  origin: string
  description?: string
  /**
   * A layout's props are supplied by the slide's frontmatter, so these are the
   * frontmatter keys that layout understands. For a slide like `layout: fact`,
   * whose whole text lives in `value` and `label`, this is the only way to edit
   * it: nothing on screen came through Markdown.
   */
  props: PropMeta[]
}

export interface Catalog {
  components: ComponentEntry[]
  layouts: LayoutEntry[]
}
