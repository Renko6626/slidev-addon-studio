/**
 * HTML entities inside a bound attribute value.
 *
 * Source text is HTML, so `&`, `<` and `>` have to be encoded before they go
 * into an attribute, and decoded before the literal parser sees them. Newlines
 * are encoded too: they are structural in a multiline prop, and a literal `\n`
 * escape is the way a cell keeps a line break.
 */

const NAMED: Record<string, string> = {
  amp: '&',
  quot: '"',
  apos: '\'',
  lt: '<',
  gt: '>',
  '#39': '\'',
  '#10': '\n',
  '#13': '\r',
}

export function decodeEntities(value: string) {
  return value.replace(/&(amp|quot|apos|lt|gt|#39|#10|#13);/g, (_, name: string) => NAMED[name]!)
}

export function encodeEntities(value: string) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '&#10;').replace(/\r/g, '&#13;')
}