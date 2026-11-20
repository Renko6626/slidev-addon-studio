import { FONT_CSS_PATH, fontFamilyValue } from '../shared/fonts'
export interface ProjectFont { family: string, label: string, faces: string[] }

interface LocalFontFace { family: string, fullName: string, postscriptName: string }
export interface FontChoice { family: string, label: string, search: string }

const commonFamilies = [
  ['Arial'], ['Calibri'], ['Verdana'], ['Georgia'], ['Times New Roman'],
  ['Microsoft YaHei', '微软雅黑'], ['SimSun', '宋体'], ['SimHei', '黑体'], ['Noto Sans CJK SC'],
]
const aliases = new Map(commonFamilies.map(([name, label]) => [name.toLowerCase(), label || name]))
export const genericFonts: FontChoice[] = ['sans-serif', 'serif', 'monospace'].map(name => ({ family: name, label: name, search: name }))
export const commonFonts: FontChoice[] = commonFamilies.map(([name, label = name]) => ({
  family: fontFamilyValue(name), label, search: (name + ' ' + label).toLowerCase(),
}))

/** Request family names during the picker-opening gesture. Font files stay on the device. */
export async function readSystemFonts(): Promise<FontChoice[] | null> {
  const host = window as Window & { queryLocalFonts?: () => Promise<LocalFontFace[]> }
  if (!host.queryLocalFonts) return null
  const groups = new Map<string, { family: string, names: Set<string> }>()
  for (const face of await host.queryLocalFonts()) {
    const family = face.family.trim()
    if (!family) continue
    const key = family.toLowerCase()
    const group = groups.get(key) ?? { family, names: new Set<string>() }
    for (const name of [family, face.fullName, face.postscriptName]) group.names.add(name)
    groups.set(key, group)
  }
  return [...groups.entries()].map(([key, { family, names }]) => {
    const label = aliases.get(key) ?? family
    names.add(label)
    return { family: fontFamilyValue(family), label, search: [...names].join(' ').toLowerCase() }
  }).sort((a, b) => a.label.localeCompare(b.label))
}

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
