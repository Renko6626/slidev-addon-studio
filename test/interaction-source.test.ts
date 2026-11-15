import { expect, it } from 'vitest'
import { parse } from 'yaml'
import { createInteractionButton, createQuizPage, listQuestions, patchInteraction, readInteraction, readInteractionText, remapCopiedInteractions, setButtonAction, writeInteractionText } from '../client/md/interactions'
import { readDrag } from '../client/md/drag'

const text = { title: 'Choose the answer', options: ['A option', 'B option', 'C option', 'D option'], correct: 'Correct!', incorrect: 'Try again.', idle: 'Choose an option.', submit: 'Confirm', clear: 'Clear' }
const canvas = { width: 960, height: 540 }

it.each(['single', 'multiple'] as const)('creates an independent %s question page with four bound option buttons', mode => {
  const page = createQuizPage(mode, canvas, text)
  const [question] = listQuestions(page.content)
  expect(parse(page.frontmatter)).toEqual({ layout: 'none', title: text.title })
  expect(question.value).toMatchObject({ question: 'question-1', mode, title: text.title, presentation: 'hidden' })
  expect(question.value.options?.filter(option => option.correct).map(option => option.id)).toEqual(mode === 'single' ? ['A'] : ['A', 'C'])
  const blocks = page.content.split('\n\n')
  expect(blocks).toHaveLength(mode === 'single' ? 7 : 9)
  for (let index = 0; index < blocks.length; index++) {
    const range: [number, number] = [index * 2, index * 2 + 1]
    expect(readDrag(page.content, range)?.via).toBe('attr')
    expect(readInteraction(page.content, range)?.question).toBe('question-1')
  }
  expect(readInteraction(page.content, [2, 3])).toMatchObject({ kind: 'title', question: 'question-1' })
  expect(readInteraction(page.content, [4, 5])).toMatchObject({ kind: 'button', action: mode === 'single' ? 'choose' : 'set-option', option: 'A', explicitLabel: false })
})

it('edits an inherited button label in its question config, preserving all positions and option identities', () => {
  const page = createQuizPage('single', canvas, text)
  const source = readInteractionText(page.content, [4, 5])!
  expect(source).toMatchObject({ kind: 'option-label', range: [0, 1], text: 'A option', option: 'A' })
  const next = writeInteractionText(page.content, source, 'A & "quoted"\n新文字')
  expect(readInteractionText(next, [4, 5])?.text).toBe('A & "quoted"\n新文字')
  expect(readInteraction(next, [4, 5])).toEqual(readInteraction(page.content, [4, 5]))
  expect(readDrag(next, [0, 1])).toEqual(readDrag(page.content, [0, 1]))
  expect(next.split('\n')).toHaveLength(page.content.split('\n').length)
})

it('edits question titles and explicit labels without expanding components into rendered HTML', () => {
  const page = createQuizPage('multiple', canvas, text)
  expect(readInteractionText(page.content, [0, 1])).toBeNull()
  const title = readInteractionText(page.content, [2, 3])!
  expect(title).toMatchObject({ kind: 'question-title', range: [0, 1], text: text.title })
  const next = writeInteractionText(page.content, title, '<literal> {{ text }}')
  expect(readInteractionText(next, [2, 3])?.text).toBe('<literal> {{ text }}')
  expect(readInteraction(next, [2, 3])).toEqual(readInteraction(page.content, [2, 3]))
  const label = readInteractionText(next, [12, 13])!
  expect(label.kind).toBe('button-label')
  expect(readInteractionText(writeInteractionText(next, label, 'Check'), [12, 13])?.text).toBe('Check')
  const feedback = readInteractionText(next, [16, 17])!
  expect(feedback).toMatchObject({ kind: 'feedback-idle', range: [0, 1], text: text.idle })
  expect(readInteractionText(writeInteractionText(next, feedback, 'Choose A, B, C or D'), [16, 17])?.text).toBe('Choose A, B, C or D')
  const shown = patchInteraction(page.content, [0, 1], { presentation: 'summary', name: 'Round 1' })
  expect(readInteraction(shown, [0, 1])).toMatchObject({ presentation: 'summary', name: 'Round 1' })
})

it('preserves unknown expressions and only allows editing the fixed option set', () => {
  const dynamic = '<StudioQuestion question="q" :title="getTitle()" :options="getOptions()" />'
  expect(readInteractionText(dynamic, [0, 1])).toBeNull()
  expect(patchInteraction(dynamic, [0, 1], { title: 'Overwrite', options: [] })).toBe(dynamic)
  const page = createQuizPage('single', canvas, text)
  const [question] = listQuestions(page.content)
  expect(patchInteraction(page.content, [0, 1], { options: question.value.options!.slice(0, 2) })).toBe(page.content)
})

it('renames a copied controller set and its references while preserving lone button bindings and source lines', () => {
  const page = createQuizPage('multiple', canvas, text)
  const existing = page.content + '\n\n<StudioQuestion question="question-2" />'
  const next = remapCopiedInteractions(page.content, existing)
  expect(listQuestions(next)[0].value.question).toBe('question-3')
  for (let line = 0; line < next.split('\n').length; line += 2) expect(readInteraction(next, [line, line + 1])?.question).toBe('question-3')
  expect(next.split('\n')).toHaveLength(page.content.split('\n').length)
  const button = page.content.split('\n\n')[2]
  expect(remapCopiedInteractions(button, existing)).toBe(button)
  const title = page.content.split('\n\n')[1]
  expect(remapCopiedInteractions(title, existing)).toBe(title)
})

it('keeps multiline props and ignores examples when locating and editing real controllers', () => {
  const source = '```vue\n<StudioQuestion question="example" />\n```\n\n<!-- <StudioQuestion question="comment" /> -->\n\n<StudioQuestion question="real" title="Question" :options="[\n { id: \'A\', label: \'Before\', correct: true }\n]" />\n\n<StudioButton question="real" action="choose" option="A" v-drag="[10,20,100,80]" />'
  expect(listQuestions(source).map(item => item.value.question)).toEqual(['real'])
  const editable = readInteractionText(source, [10, 11])!
  const next = writeInteractionText(source, editable, 'After')
  expect(readInteractionText(next, [10, 11])?.text).toBe('After')
  expect(next.split('\n')).toHaveLength(source.split('\n').length)
  expect(readDrag(next, [10, 11])).toEqual(readDrag(source, [10, 11]))
})

it('adds a usable independent button only when a real question is available', () => {
  expect(createInteractionButton('# Plain slide', canvas, 'Button')).toBeNull()
  const page = createQuizPage('single', canvas, text)
  const snippet = createInteractionButton(page.content, canvas, 'New button')!
  expect(readInteraction(snippet, [0, 1])).toMatchObject({ kind: 'button', question: 'question-1', action: 'choose', option: 'A', label: 'New button' })
})

it('keeps command button text editable after changing an inherited option button action', () => {
  const page = createQuizPage('single', canvas, text)
  const cleared = setButtonAction(page.content, [4, 5], 'clear-pending', { submit: text.submit, clear: text.clear })
  expect(readInteractionText(cleared, [4, 5])).toMatchObject({ kind: 'button-label', text: 'Clear' })
  const restored = setButtonAction(cleared, [4, 5], 'choose', { submit: text.submit, clear: text.clear })
  expect(readInteractionText(restored, [4, 5])).toMatchObject({ kind: 'option-label', text: 'A option' })
  const noLabel = '<StudioButton question="question-1" action="submit" />'
  const source = readInteractionText(noLabel, [0, 1])!
  expect(source).toMatchObject({ kind: 'button-label', text: '' })
  expect(readInteractionText(writeInteractionText(noLabel, source, 'Check now'), [0, 1])?.text).toBe('Check now')
})
