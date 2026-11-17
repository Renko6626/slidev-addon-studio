export const FONT_CSS_PATH = 'fonts/studio-fonts.css'
export const FONT_ACCEPT = '.woff2,.woff,.ttf,.otf'
export const FONT_LIMIT_MIB = 32
export interface FontUpload {
  name: string
  data: string
  family: string
  weight: number
  style: 'normal' | 'italic'
}
export function isFontFile(name: string) { return /\.(woff2?|ttf|otf)$/i.test(name) }
export function fontFamilyValue(family: string) { return `"${family.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"` }
