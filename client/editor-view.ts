export function editorOpenFromQuery(value: unknown, fallback: boolean): boolean {
  return value === '1' ? true : value === '0' ? false : fallback
}

/** Fit the real slide into the measured workspace without changing its zoom. */
export function fitSlide(
  area: { left: number, top: number, width: number, height: number },
  slide: { width: number, height: number },
) {
  const scale = Math.max(0, Math.min((area.width - 48) / slide.width, (area.height - 48) / slide.height))
  const width = slide.width * scale
  const height = slide.height * scale
  return { left: area.left + (area.width - width) / 2, top: area.top + (area.height - height) / 2, width, height, scale }
}
