import type { QuestionPresentation, QuizMode, QuizOption, QuizSignal } from '../../shared/quiz'
import type { SourceRange } from '../types'
import { createTextElement } from './elements'
import { formatPos } from './drag'
import { getBlock, replaceBlock } from './lines'
import { parseObjectArray } from './literals'
import { findAttr, opensWithTag, parseAttrs, sameAttr, writeAttr } from './tags'

export type InteractionTag = 'StudioQuestion' | 'StudioButton' | 'StudioFeedback'
export type ButtonAction = QuizSignal['action']
export const BUTTON_DEFAULTS = { fill: '#EFF6FF', color: '#1E293B', selectedFill: '#DBEAFE', correctFill: '#DCFCE7', incorrectFill: '#FEE2E2', radius: 10 }
const QUESTION_DEFAULTS = { name: '' }
const TAG_PATTERN = /<([A-Za-z][\w.-]*)\b(?:"[^"]*"|'[^']*'|[^>"'])*>/g

export function isInteractionTag(tag: string | undefined): tag is InteractionTag {
  return tag === 'StudioQuestion' || tag === 'StudioButton' || tag === 'StudioFeedback'
}
function decode(value: string) {
  return value.replace(/&(amp|quot|apos|lt|gt|#39|#10|#13);/g, (_, name: string) => ({ amp: '&', quot: '"', apos: "'", lt: '<', gt: '>', '#39': "'", '#10': '\n', '#13': '\r' })[name]!)
}
function encode(value: string) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '&#10;').replace(/\r/g, '&#13;')
}
function staticValue(block: string, name: string, fallback?: string | number): string | number | undefined {
  const opening = opensWithTag(block)
  if (!opening || parseAttrs(opening.attrs).some(attr => attr.raw === 'v-bind')) return undefined
  const attrs = parseAttrs(opening.attrs).filter(attr => sameAttr(attr.name, name))
  if (!attrs.length) return fallback
  if (attrs.length !== 1 || attrs[0].value === null) return undefined
  const attr = attrs[0]
  if (!attr.bound) return decode(attr.value!)
  const raw = decode(attr.value!)
  try { const value = JSON.parse(raw); if (typeof value === 'string' || typeof value === 'number') return value }
  catch { /* A plain single-quoted literal can still be read without evaluation. */ }
  if (/\\(?![\\'"nrtbfv0])/.test(raw)) return undefined
  const parsed = parseObjectArray(`[{ value: ${raw} }]`)
  const value = parsed?.[0]?.value
  return typeof value === 'string' || typeof value === 'number' ? value : undefined
}
function stringValue(block: string, name: string, fallback?: string) {
  const value = staticValue(block, name, fallback)
  return typeof value === 'string' ? value : null
}
function writeValue(block: string, name: string, value: string | number | QuizOption[] | null) {
  let next = value === null ? writeAttr(block, name, null)
    : writeAttr(block, name, encode(typeof value === 'string' ? value : JSON.stringify(value)), { bound: typeof value !== 'string' })
  // A compact value may replace a hand-formatted multiline prop. Keep those
  // line breaks as tag whitespace so other objects retain their source range.
  const removedLines = block.split('\n').length - next.split('\n').length
  if (removedLines > 0) {
    const at = findAttr(next, name)?.end ?? opensWithTag(next)!.attrsEnd
    next = next.slice(0, at) + '\n'.repeat(removedLines) + next.slice(at)
  }
  return next
}
function sourceBlock(content: string, range: SourceRange) {
  const block = getBlock(content, range)
  const opening = opensWithTag(block)
  if (!opening || !isInteractionTag(opening.name)) return null
  const tail = block.slice(opening.end).trim()
  if (tail && tail !== `</${opening.name}>`) return null
  return { block, tag: opening.name }
}
function optionsOf(block: string): QuizOption[] | null {
  const opening = opensWithTag(block)!
  const attrs = parseAttrs(opening.attrs).filter(attr => sameAttr(attr.name, 'options'))
  if (attrs.length > 1 || parseAttrs(opening.attrs).some(attr => attr.raw === 'v-bind')) return null
  const attr = attrs[0]
  if (!attr) return []
  if (!attr.bound) return null
  const raw = decode(attr.value ?? '')
  let rows: ReturnType<typeof parseObjectArray>
  try { const value = JSON.parse(raw); rows = Array.isArray(value) ? value : null }
  catch { rows = /\\(?![\\'"nrtbfv0])/.test(raw) ? null : parseObjectArray(raw) }
  if (!rows || rows.some(row => !row || typeof row !== 'object' || Array.isArray(row) || Object.keys(row).length !== 2 || typeof row.id !== 'string' || !row.id
    || typeof row.correct !== 'boolean')
    || new Set(rows.map(row => row.id)).size !== rows.length) return null
  return rows as unknown as QuizOption[]
}

export interface QuestionSource {
  kind: 'question'
  question: string | null
  mode: QuizMode | null
  name: string | null
  presentation: QuestionPresentation | null
  options: QuizOption[] | null
}
export interface ButtonSource {
  kind: 'button'
  question: string | null
  action: ButtonAction | null
  option: string | null
  fill: string | null
  color: string | null
  selectedFill: string | null
  correctFill: string | null
  incorrectFill: string | null
  radius: number | null
}
export interface FeedbackSource { kind: 'feedback', question: string | null, effect: 'none' | 'fade' | 'pop' | null }
export interface ContentSource { kind: 'content', question: string | null }
export type InteractionSource = QuestionSource | ButtonSource | FeedbackSource | ContentSource

export function readInteraction(content: string, range: SourceRange): InteractionSource | null {
  const raw = getBlock(content, range)
  const opening = opensWithTag(raw)
  if (opening && !isInteractionTag(opening.name)) {
    const key = findAttr(raw, 'data-studio-question-ref') ? 'data-studio-question-ref'
      : /^[A-Z]/.test(opening.name) && findAttr(raw, 'question') ? 'question' : null
    return key ? { kind: 'content', question: stringValue(raw, key) } : null
  }
  const source = sourceBlock(content, range)
  if (!source) return null
  const { block, tag } = source
  const question = stringValue(block, 'question')
  if (tag === 'StudioQuestion') {
    const mode = stringValue(block, 'mode', 'single')
    const presentation = stringValue(block, 'presentation', 'hidden')
    return { kind: 'question', question, mode: mode === 'single' || mode === 'multiple' ? mode : null,
      presentation: presentation === 'hidden' || presentation === 'summary' ? presentation : null,
      options: optionsOf(block), ...Object.fromEntries(Object.entries(QUESTION_DEFAULTS).map(([key, value]) => [key, stringValue(block, key, value)])) } as QuestionSource
  }
  if (tag === 'StudioButton') {
    const action = stringValue(block, 'action')
    const radius = staticValue(block, 'radius', BUTTON_DEFAULTS.radius)
    return { kind: 'button', question,
      action: ['choose', 'set-option', 'submit', 'clear-pending'].includes(action ?? '') ? action as ButtonAction : null,
      option: stringValue(block, 'option', ''),
      ...Object.fromEntries(Object.entries(BUTTON_DEFAULTS).filter(([name]) => name !== 'radius').map(([name, value]) => [name, stringValue(block, name, String(value))])),
      radius: radius !== undefined && Number.isFinite(Number(radius)) ? Number(radius) : null } as ButtonSource
  }
  const effect = stringValue(block, 'effect', 'fade')
  return { kind: 'feedback', question, effect: ['none', 'fade', 'pop'].includes(effect ?? '') ? effect as FeedbackSource['effect'] : null }
}

/** Ignore examples in fenced code and HTML comments when finding controllers. */
function interactionTags(content: string) {
  let fence = ''
  const masked = content.split('\n').map(line => {
    const mark = line.match(/^\s*(`{3,}|~{3,})/)?.[1]
    if (mark && (!fence || mark[0] === fence[0] && mark.length >= fence.length)) { fence = fence ? '' : mark; return line.replace(/./g, ' ') }
    return fence ? line.replace(/./g, ' ') : line
  }).join('\n').replace(/<!--[\s\S]*?-->/g, match => match.replace(/[^\n]/g, ' '))
  return [...masked.matchAll(TAG_PATTERN)].map(match => ({
    tag: match[1], start: match.index!, end: match.index! + match[0].length,
    range: [content.slice(0, match.index).split('\n').length - 1, content.slice(0, match.index! + match[0].length).split('\n').length] as SourceRange,
    block: content.slice(match.index, match.index! + match[0].length),
  }))
}

export function listQuestions(content: string): { range: SourceRange, value: QuestionSource }[] {
  return interactionTags(content).filter(item => item.tag === 'StudioQuestion').map(item => ({ range: item.range, value: readInteraction(content, item.range) }))
    .filter((item): item is { range: SourceRange, value: QuestionSource } => item.value?.kind === 'question')
}
function findQuestion(content: string, question: string) {
  const matches = listQuestions(content).filter(item => item.value.question === question)
  return matches.length === 1 ? matches[0] : null
}

export function patchInteraction(content: string, range: SourceRange, patch: Record<string, string | number | QuizOption[] | null>): string {
  const current = readInteraction(content, range)
  if (!current) return content
  const editable = current.kind === 'question' ? ['name', 'presentation', 'options']
    : current.kind === 'button' ? ['question', 'action', 'option', ...Object.keys(BUTTON_DEFAULTS)]
      : current.kind === 'content' ? ['question'] : ['question', 'effect']
  let block = getBlock(content, range)
  for (const [name, value] of Object.entries(patch)) {
    if (!editable.includes(name) || (current as unknown as Record<string, unknown>)[name] === null) continue
    if (name === 'options' && (!Array.isArray(value) || !('options' in current) || !current.options
      || value.map(item => item.id).join('\0') !== current.options.map(item => item.id).join('\0'))) continue
    block = writeValue(block, current.kind === 'content' && name === 'question' && findAttr(block, 'data-studio-question-ref') ? 'data-studio-question-ref' : name, value)
  }
  return replaceBlock(content, range, block)
}

/** Actions change the binding, while the button keeps its authored content. */
export function setButtonAction(content: string, range: SourceRange, action: ButtonAction): string {
  const button = readInteraction(content, range)
  if (button?.kind !== 'button' || !button.question || !button.action) return content
  const target = findQuestion(content, button.question)?.value
  if (!target?.mode) return content
  if (action === 'choose' || action === 'set-option') {
    if (!target.options?.length || action !== (target.mode === 'single' ? 'choose' : 'set-option')) return content
    return patchInteraction(content, range, { action, option: target.options.find(option => option.id === button.option)?.id ?? target.options[0].id })
  }
  return patchInteraction(content, range, { action, option: null })
}

function nextQuestion(used: Set<string>) {
  let number = 1
  while (used.has(`question-${number}`)) number++
  const id = `question-${number}`
  used.add(id)
  return id
}
/** Remap only a copied set that contains its controller; lone buttons stay bound. */
export function remapCopiedInteractions(source: string, existingContent: string): string {
  const tags = interactionTags(source)
  function keys(item: (typeof tags)[number]) {
    return ['data-studio-question-ref', ...(/^[A-Z]/.test(item.tag) ? ['question'] : [])]
  }
  const ids = (items: typeof tags) => items.flatMap(item => keys(item).map(key => stringValue(item.block, key))).filter((id): id is string => !!id)
  const used = new Set([...ids(interactionTags(existingContent)), ...ids(tags)])
  const replacements = new Map<string, string>()
  for (const item of tags.filter(item => item.tag === 'StudioQuestion')) {
    const id = stringValue(item.block, 'question')
    if (id && !replacements.has(id)) replacements.set(id, nextQuestion(used))
  }
  let next = source
  for (const item of tags.reverse()) {
    let block = item.block
    for (const key of keys(item)) {
      const id = stringValue(block, key)
      if (id && replacements.has(id)) block = writeValue(block, key, replacements.get(id)!)
    }
    if (block !== item.block) next = next.slice(0, item.start) + block + next.slice(item.end)
  }
  return next
}

export interface QuizTemplateText { title: string, name?: string, options: string[], correct: string, incorrect: string, idle: string, submit: string, clear: string }
export function createQuizPage(mode: QuizMode, canvas: { width: number, height: number }, text: QuizTemplateText) {
  const question = 'question-1'
  const options: QuizOption[] = ['A', 'B', 'C', 'D'].map((id, index) => ({ id, correct: mode === 'single' ? index === 0 : index === 0 || index === 2 }))
  const positioned = (block: string, x: number, y: number, w: number, h: number) => writeAttr(block, 'v-drag', formatPos({ x, y, w, h, rotate: 0 }, 'attr'))
  const sx = canvas.width / 960, sy = canvas.height / 540
  let control = '<StudioQuestion />'
  for (const [name, value] of Object.entries({ question, mode, name: text.name ?? question, options })) control = writeValue(control, name, value)
  const blocks = [positioned(control, 70 * sx, 10 * sy, 220 * sx, 32 * sy),
    positioned(writeValue(createTextElement(canvas, text.title).replace('font-size:28px', 'font-size:32px'), 'data-studio-question-ref', question), 70 * sx, 60 * sy, 820 * sx, 80 * sy)]
  options.forEach((option, index) => blocks.push(positioned(writeValue(`<StudioButton question="${question}" action="${mode === 'single' ? 'choose' : 'set-option'}" option="${option.id}" />`, 'contentHtml', textHtml(text.options[index] ?? option.id)), (70 + index % 2 * 420) * sx, (170 + Math.floor(index / 2) * 96) * sy, 400 * sx, 76 * sy)))
  if (mode === 'multiple') {
    blocks.push(positioned(writeValue(`<StudioButton question="${question}" action="submit" fill="#2563EB" color="#FFFFFF" />`, 'contentHtml', textHtml(text.submit)), 70 * sx, 370 * sy, 190 * sx, 52 * sy))
    blocks.push(positioned(writeValue(`<StudioButton question="${question}" action="clear-pending" />`, 'contentHtml', textHtml(text.clear)), 280 * sx, 370 * sy, 190 * sx, 52 * sy))
  }
  let feedback = `<StudioFeedback question="${question}" effect="fade" />`
  for (const [key, value] of Object.entries({ correctText: text.correct, incorrectText: text.incorrect, idleText: text.idle })) feedback = writeValue(feedback, key, value)
  blocks.push(positioned(feedback, 70 * sx, (mode === 'multiple' ? 444 : 390) * sy, 820 * sx, 56 * sy))
  return { content: blocks.join('\n\n'), frontmatter: `layout: none\ntitle: ${JSON.stringify(text.title)}` }
}

export function createInteractionButton(content: string, canvas: { width: number, height: number }, label: string, question?: string): string | null {
  const target = question ? findQuestion(content, question) : listQuestions(content).find(item => item.value.question && item.value.mode && item.value.options?.length)
  if (!target?.value.question || !target.value.mode || !target.value.options?.length) return null
  let block = '<StudioButton />'
  for (const [name, value] of Object.entries({ question: target.value.question, action: target.value.mode === 'single' ? 'choose' : 'set-option', option: target.value.options[0].id, contentHtml: textHtml(label) })) block = writeValue(block, name, value)
  return writeAttr(block, 'v-drag', formatPos({ x: canvas.width * 0.4, y: canvas.height * 0.4, w: canvas.width * 0.2, h: canvas.height * 0.1, rotate: 0 }, 'attr'))
}

function textHtml(text: string): string {
  return `<p>${text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\r?\n/g, '<br>')}</p>`
}
