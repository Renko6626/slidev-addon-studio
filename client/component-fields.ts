import type { CatalogComponent, PropMeta, StudioTarget } from './types'

export interface ComponentFieldTarget {
  owner: StudioTarget
  prop: PropMeta
  element: HTMLElement | null
}

/** A marker belongs only to its nearest declared component root. */
export function componentFieldElement(owner: StudioTarget, name: string): HTMLElement | null {
  if (!owner.range || owner.el.dataset.studioComponent !== owner.tag) return null
  const fields = [...owner.el.querySelectorAll<HTMLElement>('[data-studio-field]')]
    .filter(el => el.dataset.studioField === name && el.closest('[data-studio-component]') === owner.el)
  return fields.length === 1 ? fields[0] : null
}

export function fieldAt(owner: StudioTarget, node: EventTarget | null): HTMLElement | null {
  if (!(node instanceof Element)) return null
  const field = node.closest<HTMLElement>('[data-studio-field]')
  return field && componentFieldElement(owner, field.dataset.studioField!) === field ? field : null
}

export function resolveComponentField(owner: StudioTarget, node: EventTarget | null, component: CatalogComponent): ComponentFieldTarget | null {
  if (component.name !== owner.tag) return null
  const element = fieldAt(owner, node)
  const prop = component.props.find(prop => !prop.hidden && prop.name === element?.dataset.studioField)
  if (!element || !prop) return null
  if (prop.control === 'richtext' && (element.tagName !== 'DIV' || element.querySelector('[data-studio-field], [data-studio-component]'))) return null
  if (prop.control === 'image' && element.tagName !== 'IMG') return null
  return { owner, prop, element }
}
