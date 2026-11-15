import type { QuizMode, QuizOption } from '../../shared/quiz'
import type { SourceRange } from '../types'
import { formatPos } from './drag'
import { getBlock, replaceBlock } from './lines'
import { parseObjectArray } from './literals'
import { findAttr, opensWithTag, parseAttrs, sameAttr, writeAttr } from './tags'

export type InteractionTag = 'StudioQuestion' | 'StudioButton' | 'StudioFeedback'
export type ButtonAction = 'choose' | 'set-option' | 'submit' | 'clear-pending'
export const BUTTON_DEFAULTS = { fill: '#EFF6FF', color: '#1E293B', selectedFill: '#DBEAFE', correctFill: '#DCFCE7', incorrectFill: '#FEE2E2', radius: 10 }
const QUESTION_DEFAULTS = { title: '', correctText: 'Correct!', incorrectText: 'Try again.', idleText: '' }
const TAG_PATTERN = /<(StudioQuestion|StudioButton|StudioFeedback)\b(?:"[^"]*"|'[^']*'|[^>"'])*>/g

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
  if (!rows || rows.some(row => !row || typeof row !== 'object' || Array.isArray(row) || Object.keys(row).length !== 3 || typeof row.id !== 'string' || !row.id
    || typeof row.label !== 'string' || typeof row.correct !== 'boolean')
    || new Set(rows.map(row => row.id)).size !== rows.length) return null
  return rows as unknown as QuizOption[]
}

export interface QuestionSource {
  kind: 'question'
  question: string | null
  mode: QuizMode | null
  title: string | null
  options: QuizOption[] | null
  correctText: string | null
  incorrectText: string | null
  idleText: string | null
}
export interface ButtonSource {
  kind: 'button'
  question: string | null
  action: ButtonAction | null
  option: string | null
  label: string | null
  explicitLabel: boolean
  fill: string | null
  color: string | null
  selectedFill: string | null
  correctFill: string | null
  incorrectFill: string | null
  radius: number | null
}
export interface FeedbackSource { kind: 'feedback', question: string | null, effect: 'none' | 'fade' | 'pop' | null }
export type InteractionSource = QuestionSource | ButtonSource | FeedbackSource

export function readInteraction(content: string, range: SourceRange): InteractionSource | null {
  const source = sourceBlock(content, range)
  if (!source) return null
  const { block, tag } = source
  const question = stringValue(block, 'question')
  if (tag === 'StudioQuestion') {
    const mode = stringValue(block, 'mode', 'single')
    return { kind: 'question', question, mode: mode === 'single' || mode === 'multiple' ? mode : null,
      options: optionsOf(block), ...Object.fromEntries(Object.entries(QUESTION_DEFAULTS).map(([key, value]) => [key, stringValue(block, key, value)])) } as QuestionSource
  }
  if (tag === 'StudioButton') {
    const action = stringValue(block, 'action')
    const radius = staticValue(block, 'radius', BUTTON_DEFAULTS.radius)
    return { kind: 'button', question,
      action: ['choose', 'set-option', 'submit', 'clear-pending'].includes(action ?? '') ? action as ButtonAction : null,
      option: stringValue(block, 'option', ''), label: stringValue(block, 'label', ''), explicitLabel: !!findAttr(block, 'label'),
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
    tag: match[1] as InteractionTag, start: match.index!, end: match.index! + match[0].length,
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
  const editable = current.kind === 'question' ? ['title', 'options', 'correctText', 'incorrectText', 'idleText']
    : current.kind === 'button' ? ['question', 'action', 'option', 'label', ...Object.keys(BUTTON_DEFAULTS)] : ['question', 'effect']
  let block = getBlock(content, range)
  for (const [name, value] of Object.entries(patch)) {
    if (!editable.includes(name) || (current as unknown as Record<string, unknown>)[name] === null) continue
    if (name === 'options' && (!Array.isArray(value) || !('options' in current) || !current.options
      || value.map(item => item.id).join('\0') !== current.options.map(item => item.id).join('\0'))) continue
    block = writeValue(block, name, value)
  }
  return replaceBlock(content, range, block)
}

export interface InteractionTextSource {
  kind: 'question-title' | 'button-label' | 'option-label' | 'feedback-idle'
  range: SourceRange
  text: string
  question: string
  option?: string
}
export function readInteractionText(content: string, range: SourceRange): InteractionTextSource | null {
  const current = readInteraction(content, range)
  if (!current?.question) return null
  if (current.kind === 'question') return current.title === null ? null : { kind: 'question-title', range: [...range], text: current.title, question: current.question }
  if (current.kind === 'feedback') {
    const target = findQuestion(content, current.question)
    return target && target.value.idleText !== null ? { kind: 'feedback-idle', range: target.range, text: target.value.idleText, question: current.question } : null
  }
  if (current.kind !== 'button') return null
  if (current.explicitLabel) return current.label === null ? null : { kind: 'button-label', range: [...range], text: current.label, question: current.question }
  if (current.action === 'submit' || current.action === 'clear-pending') return { kind: 'button-label', range: [...range], text: '', question: current.question }
  const target = findQuestion(content, current.question)
  const option = target?.value.options?.find(item => item.id === current.option)
  return target && option ? { kind: 'option-label', range: target.range, text: option.label, question: current.question, option: option.id } : null
}
export function writeInteractionText(content: string, source: InteractionTextSource, text: string): string {
  const current = readInteraction(content, source.range)
  if (!current || current.question !== source.question) return content
  if (source.kind === 'question-title' && current.kind === 'question') return patchInteraction(content, source.range, { title: text })
  if (source.kind === 'button-label' && current.kind === 'button') return patchInteraction(content, source.range, { label: text })
  if (source.kind === 'feedback-idle' && current.kind === 'question') return patchInteraction(content, source.range, { idleText: text })
  if (source.kind === 'option-label' && current.kind === 'question' && current.options?.some(option => option.id === source.option))
    return patchInteraction(content, source.range, { options: current.options.map(option => option.id === source.option ? { ...option, label: text } : option) })
  return content
}

/** Changing the purpose gives command buttons a label; option buttons inherit. */
export function setButtonAction(content: string, range: SourceRange, action: ButtonAction, labels: { submit: string, clear: string }): string {
  const button = readInteraction(content, range)
  if (button?.kind !== 'button' || !button.question || !button.action) return content
  const target = findQuestion(content, button.question)?.value
  if (!target?.mode) return content
  if (action === 'choose' || action === 'set-option') {
    if (!target.options?.length || action !== (target.mode === 'single' ? 'choose' : 'set-option')) return content
    return patchInteraction(content, range, { action, option: target.options.find(option => option.id === button.option)?.id ?? target.options[0].id, label: null })
  }
  return patchInteraction(content, range, { action, option: null, label: action === 'submit' ? labels.submit : labels.clear })
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
  const used = new Set(interactionTags(existingContent).map(item => stringValue(item.block, 'question')).filter((value): value is string => value !== null))
  for (const item of tags) { const id = stringValue(item.block, 'question'); if (id) used.add(id) }
  const replacements = new Map<string, string>()
  for (const item of tags.filter(item => item.tag === 'StudioQuestion')) {
    const id = stringValue(item.block, 'question')
    if (id && !replacements.has(id)) replacements.set(id, nextQuestion(used))
  }
  let next = source
  for (const item of tags.reverse()) {
    const id = stringValue(item.block, 'question')
    if (id && replacements.has(id)) next = next.slice(0, item.start) + writeValue(item.block, 'question', replacements.get(id)!) + next.slice(item.end)
  }
  return next
}

export interface QuizTemplateText { title: string, options: string[], correct: string, incorrect: string, idle: string, submit: string, clear: string }
export function createQuizPage(mode: QuizMode, canvas: { width: number, height: number }, text: QuizTemplateText) {
  const question = 'question-1'
  const options: QuizOption[] = ['A', 'B', 'C', 'D'].map((id, index) => ({ id, label: text.options[index] ?? id, correct: mode === 'single' ? index === 0 : index === 0 || index === 2 }))
  const positioned = (block: string, x: number, y: number, w: number, h: number) => writeAttr(block, 'v-drag', formatPos({ x, y, w, h, rotate: 0 }, 'attr'))
  const sx = canvas.width / 960, sy = canvas.height / 540
  let title = '<StudioQuestion />'
  for (const [name, value] of Object.entries({ question, mode, title: text.title, options, correctText: text.correct, incorrectText: text.incorrect, idleText: text.idle })) title = writeValue(title, name, value)
  const blocks = [positioned(title, 70 * sx, 46 * sy, 820 * sx, 94 * sy)]
  options.forEach((option, index) => blocks.push(positioned(`<StudioButton question="${question}" action="${mode === 'single' ? 'choose' : 'set-option'}" option="${option.id}" />`, (70 + index % 2 * 420) * sx, (170 + Math.floor(index / 2) * 96) * sy, 400 * sx, 76 * sy)))
  if (mode === 'multiple') {
    blocks.push(positioned(writeValue(`<StudioButton question="${question}" action="submit" fill="#2563EB" color="#FFFFFF" />`, 'label', text.submit), 70 * sx, 370 * sy, 190 * sx, 52 * sy))
    blocks.push(positioned(writeValue(`<StudioButton question="${question}" action="clear-pending" />`, 'label', text.clear), 280 * sx, 370 * sy, 190 * sx, 52 * sy))
  }
  blocks.push(positioned(`<StudioFeedback question="${question}" effect="fade" />`, 70 * sx, (mode === 'multiple' ? 444 : 390) * sy, 820 * sx, 56 * sy))
  return { content: blocks.join('\n\n'), frontmatter: `layout: none\ntitle: ${JSON.stringify(text.title)}` }
}

export function createInteractionButton(content: string, canvas: { width: number, height: number }, label: string, question?: string): string | null {
  const target = question ? findQuestion(content, question) : listQuestions(content).find(item => item.value.question && item.value.mode && item.value.options?.length)
  if (!target?.value.question || !target.value.mode || !target.value.options?.length) return null
  let block = '<StudioButton />'
  for (const [name, value] of Object.entries({ question: target.value.question, action: target.value.mode === 'single' ? 'choose' : 'set-option', option: target.value.options[0].id, label })) block = writeValue(block, name, value)
  return writeAttr(block, 'v-drag', formatPos({ x: canvas.width * 0.4, y: canvas.height * 0.4, w: canvas.width * 0.2, h: canvas.height * 0.1, rotate: 0 }, 'attr'))
}
