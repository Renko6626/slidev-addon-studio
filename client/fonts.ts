import { FONT_CSS_PATH } from '../shared/fonts'
export interface ProjectFont { family: string, label: string, faces: string[] }

/** CSSOM reads the same standard declarations used by the presentation. */
export function applyProjectFontCSS(css: string): ProjectFont[] {
  let element = document.getElementById('studio-project-fonts') as HTMLStyleElement | null
  if (!element) {
    element = document.createElement('style')
    element.id = 'studio-project-fonts'
    document.head.append(element)
  }
  element.textContent = css
  const fonts = new Map<string, ProjectFont>()
  for (const rule of Array.from(element.sheet?.cssRules ?? [])) {
    if (rule.type !== 5) continue // CSSRule.FONT_FACE_RULE
    const style = (rule as CSSFontFaceRule).style
    // Inline preview CSS has the document URL as its base, unlike the file
    // registration. Resolve its font URLs against the registry's directory.
    const base = new URL(`${import.meta.env.BASE_URL}${FONT_CSS_PATH}`, window.location.origin)
    style.setProperty('src', style.getPropertyValue('src').replace(/url\(\s*("[^"]*"|'[^']*'|[^)]*)\s*\)/gi, (_, value: string) => {
      const url = value.trim().replace(/^(["'])(.*)\1$/, '$2')
      return `url("${new URL(url, base).href}")`
    }))
    const family = style.getPropertyValue('font-family').trim()
    if (!family) continue
    const label = family.replace(/^(["'])(.*)\1$/, '$2')
    const item = fonts.get(family) ?? { family, label, faces: [] }
    item.faces.push(`${style.getPropertyValue('font-weight') || '400'}${style.getPropertyValue('font-style') === 'italic' ? ' italic' : ''}`)
    fonts.set(family, item)
  }
  return [...fonts.values()]
}
