export { editorOpenFromQuery } from '../shared/editor-mode'

/** Fit the real slide into the measured workspace without changing its zoom. */
export function fitSlide(
  area: { left: number, top: number, width: number, height: number },
  slide: { width: number, height: number },
) {
  const scale = Math.max(0, Math.min((area.width - 48) / slide.width, (area.height - 48) / slide.height))
  return placeSlide(area, slide, scale)
}

/** Editor-only scale and pan in screen pixels; slide source stays unchanged. */
export function placeSlide(
  area: { left: number, top: number, width: number, height: number },
  slide: { width: number, height: number },
  scale: number,
  pan = { x: 0, y: 0 },
) {
  const width = slide.width * scale
  const height = slide.height * scale
  return { left: area.left + (area.width - width) / 2 + pan.x, top: area.top + (area.height - height) / 2 + pan.y, width, height, scale }
}
