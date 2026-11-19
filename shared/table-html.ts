/**
 * The inline HTML subset a rich StudioTable cell may contain.
 *
 * Cells are edited by a small rich-text editor, but agents may also hand-write
 * them. Anything outside this subset disables visual editing for the table
 * rather than letting the editor silently drop markup. Rendering still cleans
 * the same subset, so a published deck cannot carry scripts or unknown tags.
 */

const INLINE_TAGS = new Set(['strong', 'b', 'em', 'i', 'u', 's', 'strike', 'del', 'code', 'a', 'span', 'br'])
const DROP_TAGS = new Set(['script', 'style', 'iframe', 'object', 'embed', 'template', 'svg', 'math', 'link', 'meta'])
const STYLE_KEYS = new Set(['color', 'background-color', 'font-size', 'font-weight', 'font-style', 'text-decoration', 'text-decoration-line'])
const LINK_ATTRS = new Set(['href', 'target', 'rel', 'style'])
const SPAN_ATTRS = new Set(['style'])

function safeColor(value: string) {
  return /^#[0-9a-f]{3,8}$/i.test(value)
    || /^(?:rgb|hsl|oklch|lab|color)a?\([^()]*\)$/i.test(value)
    || /^var\(--[\w-]+\)$/.test(value)
    || /^[a-z]{3,20}$/i.test(value)
}

function safeStyle(key: string, value: string) {
  const text = value.trim()
  if (!text || text.length > 200 || /url\s*\(|expression|javascript:|@import/i.test(text))
    return false
  if (key === 'color' || key === 'background-color')
    return safeColor(text)
  if (key === 'font-size')
    return /^\d+(?:\.\d+)?(?:px|pt|em|rem|%)$/.test(text)
  if (key === 'font-weight')
    return /^(?:normal|bold|[1-9]00)$/.test(text)
  if (key === 'font-style')
    return /^(?:normal|italic|oblique)$/.test(text)
  if (key === 'text-decoration' || key === 'text-decoration-line')
    return /^(?:none|underline|line-through|overline)(?: (?:underline|line-through|overline))*$/.test(text)
  return false
}

function safeHref(value: string) {
  const text = value.trim()
  if (!text)
    return false
  if (/^[a-z][a-z0-9+.-]*:/i.test(text))
    return /^(?:https?|mailto):/i.test(text)
  return true
}

function cleanStyle(element: HTMLElement, strict: boolean) {
  const keys: string[] = []
  for (let index = 0; index < element.style.length; index++)
    keys.push(element.style.item(index))
  for (const key of keys) {
    if (!STYLE_KEYS.has(key) || !safeStyle(key, element.style.getPropertyValue(key))) {
      if (strict)
        return false
      element.style.removeProperty(key)
    }
  }
  if (!element.getAttribute('style'))
    element.removeAttribute('style')
  return true
}

function cleanElement(element: Element, strict: boolean) {
  const tag = element.tagName.toLowerCase()
  if (DROP_TAGS.has(tag)) {
    if (strict)
      return false
    element.remove()
    return true
  }
  if (!INLINE_TAGS.has(tag)) {
    if (strict)
      return false
    element.replaceWith(...element.childNodes)
    return true
  }
  const allowed = tag === 'a' ? LINK_ATTRS : tag === 'span' ? SPAN_ATTRS : new Set<string>()
  for (const attr of [...element.attributes]) {
    const name = attr.name.toLowerCase()
    if (!allowed.has(name)) {
      if (strict)
        return false
      element.removeAttribute(attr.name)
      continue
    }
    if (name === 'href' && !safeHref(attr.value)) {
      if (strict)
        return false
      element.removeAttribute(attr.name)
    }
    else if (name === 'target' && !/^_(?:blank|self|parent|top)$/.test(attr.value)) {
      if (strict)
        return false
      element.removeAttribute(attr.name)
    }
    else if (name === 'rel' && !/^(?:noopener|noreferrer|nofollow)(?: (?:noopener|noreferrer|nofollow))*$/.test(attr.value)) {
      if (strict)
        return false
      element.removeAttribute(attr.name)
    }
  }
  if (element instanceof HTMLElement && element.hasAttribute('style') && !cleanStyle(element, strict))
    return false
  return true
}

function clean(input: string, strict: boolean): string | null {
  if (typeof document === 'undefined')
    return strict ? null : escapeCellText(input)

  const root = document.createElement('div')
  root.innerHTML = input

  const comments = document.createTreeWalker(root, NodeFilter.SHOW_COMMENT)
  if (comments.nextNode()) {
    if (strict)
      return null
    const found: Comment[] = []
    while (comments.currentNode) {
      found.push(comments.currentNode as Comment)
      if (!comments.nextNode())
        break
    }
    for (const comment of found)
      comment.remove()
  }

  // Reverse order lets a disallowed wrapper unwrap after its children were
  // checked, without leaving unvalidated markup behind.
  for (const element of [...root.querySelectorAll('*')].reverse()) {
    if (!cleanElement(element, strict))
      return null
  }
  return root.innerHTML
}

export function escapeCellText(text: string) {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/** Plain cell text as the inline HTML a rich cell stores. */
export function cellHTMLFromText(text: string) {
  return escapeCellText(text.replace(/\r\n?/g, '\n')).replace(/\n/g, '<br>')
}

/** Rich cell HTML as plain text, keeping line breaks and dropping marks. */
export function flattenCellHTML(html: string) {
  if (typeof document === 'undefined')
    return html.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]*>/g, '')
  const root = document.createElement('div')
  root.innerHTML = html
  for (const br of [...root.querySelectorAll('br')])
    br.replaceWith('\n')
  return (root.textContent ?? '').replace(/\u00a0/g, ' ')
}

/** Whether the editor can safely open this cell. */
export function validateCellHTML(html: string) {
  return clean(html, true) !== null
}

/** The subset a published slide may render; unknown markup is removed. */
export function sanitiseCellHTML(html: string) {
  return clean(html, false) ?? ''
}

/** A Tiptap document as the inline HTML stored in a cell. */
export function editorHTMLToCell(html: string) {
  if (typeof document === 'undefined')
    return html
  const root = document.createElement('div')
  root.innerHTML = html
  const blocks = [...root.children]
  if (!blocks.length)
    return ''
  return sanitiseCellHTML(blocks.map(block => block.innerHTML).join('<br>'))
}