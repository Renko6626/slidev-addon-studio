import type { SourceRange, StudioTarget, TargetKind } from './types'
import { belongsToSlide, elementRoot, mappedElements } from './dom'
import { normalise, resolveRange } from './md/locate'
import { positionedUnit, readDrag } from './md/drag'
import { readElement } from './md/elements'

/** Hidden click-step objects must not be picked by the geometric fallback. */
export function isVisible(el: Element): boolean {
  const style = getComputedStyle(el)
  return style.visibility !== 'hidden' && Number.parseFloat(style.opacity) > 0.01
}

/** Ignore editor overlays when looking through to the slide beneath them. */
export function isStudioChrome(target: EventTarget | null): target is Element {
  return target instanceof Element && !!target.closest('.slidev-studio')
}

/** Resolve pointer hits against the current slide, including covered embeds. */
export function createTargetResolver(no: () => number, content: () => string) {
  function targetFrom(node: EventTarget | null): StudioTarget | null {
    if (!(node instanceof Element))
      return null
    if (node.closest('[data-studio-background]'))
      return null

    // Only the slide being edited: a click on the pre-rendered next slide
    // would otherwise be traced against the wrong Markdown.
    if (!belongsToSlide(node, no()))
      return null

    // A code editor embedded in a slide is the one thing on the canvas that
    // needs the raw click: claiming it would make the editor untypeable.
    if (node.closest('.monaco-editor, .slidev-monaco-container'))
      return null

    // Whichever is nearer: a block of Markdown, or a string a layout was handed.
    // Nesting decides, because a labelled string can sit inside a mapped block
    // and the inner one is what was aimed at.
    const el = node.closest<HTMLElement>('[data-studio-src], [data-studio-prop]')
    if (!el || !belongsToSlide(el, no()))
      return null

    return describeTarget(el, no(), content())
  }

  /**
   * Finds a block by where the pointer is rather than by what it hit.
   *
   * An embedded frame swallows the pointer, so Studio turns pointer events off
   * for embeds while it is open. That makes a component whose root *is* the
   * frame, such as Youtube or Tweet, impossible to hit the ordinary way: the
   * click passes straight through to the layout behind it. This picks the
   * smallest mapped element that the point falls inside, among exactly those
   * elements the editor made unhittable.
   */
  function targetFromPoint(x: number, y: number): StudioTarget | null {
    const candidates = mappedElements(no())
      .filter(el => getComputedStyle(el).pointerEvents === 'none' && isVisible(el))
      .map(el => ({ el, box: el.getBoundingClientRect() }))
      .filter(({ box }) => x >= box.left && x <= box.right && y >= box.top && y <= box.bottom)
      .sort((a, b) => a.box.width * a.box.height - b.box.width * b.box.height)

    return candidates.length ? describeTarget(candidates[0].el, no(), content()) : null
  }

  /**
   * What the pointer is over, ignoring Studio's own chrome on top of it.
   *
   * The selection overlay covers the block it belongs to, so the ordinary
   * target of a click there is the overlay rather than anything on the slide.
   */
  function throughChrome(x: number, y: number): StudioTarget | null {
    for (const node of document.elementsFromPoint(x, y)) {
      if (isStudioChrome(node))
        continue
      const target = targetFrom(node)
      if (target)
        return target
    }
    return targetFromPoint(x, y)
  }

  return { targetFrom, targetFromPoint, throughChrome }
}

/**
 * The element's text, with a separator at every element boundary.
 *
 * `textContent` concatenates descendants with nothing between them, so
 * `<h1>angripere<br>faktisk</h1>` reads as "angriperefaktisk" and a table's
 * header row as "PakkeLengdePublikum". The Markdown side turns every tag into a
 * space, so comparing the two would never match. Tables, headings with inline
 * markup and many lists all failed for this one reason.
 */
function textOf(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE)
    return node.textContent ?? ''
  if (node.nodeType !== Node.ELEMENT_NODE)
    return ''
  return [...node.childNodes].map(textOf).join(' ')
}

/** Re-check annotation hints against Markdown before exposing an editable range. */
export function describeTarget(el: HTMLElement, no: number, content: string): StudioTarget {
  el = elementRoot(el)
  const prop = el.dataset.studioProp
  if (prop) {
    return {
      el,
      no,
      range: null,
      kind: 'frontmatter',
      prop,
      positioned: false,
      nested: false,
      label: prop,
    }
  }

  const kind = (el.dataset.studioKind ?? 'unknown') as TargetKind
  const tag = el.dataset.studioTag
  const hint = parseHint(el.dataset.studioSrc)

  const signature = {
    kind,
    tag,
    sig: el.dataset.studioSig,
    text: tag ? undefined : normalise(textOf(el)),
    nested: el.dataset.studioNested === '1',
  }
  const range = resolveRange(content, hint, signature)

  return {
    el,
    no,
    range,
    element: range ? readElement(content, range)?.kind : undefined,
    kind,
    tag,
    positioned: range ? !!readDrag(content, range) : false,
    nested: el.dataset.studioNested === '1',
    label: labelFor(kind, tag, el),
  }
}

export function parseHint(raw: string | undefined): SourceRange | null {
  if (!raw)
    return null
  const [start, end] = raw.split(',').map(Number)
  return Number.isFinite(start) && Number.isFinite(end) ? [start, end] : null
}

function labelFor(kind: TargetKind, tag: string | undefined, el: HTMLElement): string {
  if (tag)
    return `<${tag}>`
  switch (kind) {
    case 'heading': return el.tagName.toUpperCase()
    case 'paragraph': return 'Text'
    case 'list': return 'List'
    case 'list-item': return 'List item'
    case 'quote': return 'Quote'
    case 'table': return 'Table'
    case 'rule': return 'Divider'
    case 'code': return 'Code block'
    default: return el.tagName.toLowerCase()
  }
}

export function sameRange(a: SourceRange | null, b: SourceRange | null) {
  return !!a && !!b && a[0] === b[0] && a[1] === b[1]
}

/** Only objects whose source and positioning belong to this selectable root. */
export function isMultiSelectable(target: StudioTarget, content: string): boolean {
  if (!target.range || target.nested || target.prop || target.el.closest('[data-studio-background]') || !(target.element || target.kind === 'component')) return false
  const drag = readDrag(content, target.range)
  if (!drag?.pos) return false
  const unit = positionedUnit(content, target.range)
  // Sharing a wrapper with siblings would move those siblings too.
  if (drag.via === 'wrapper' && !/^v-?drag$/i.test(target.tag ?? '')) {
    const before = content.split('\n').slice(unit[0] + 1, target.range[0]).join('\n').trim()
    const after = content.split('\n').slice(target.range[1], unit[1] - 1).join('\n').trim()
    if (before || after) return false
  }
  return true
}
