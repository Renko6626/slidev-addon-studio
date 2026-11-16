import { expect, it } from 'vitest'
import { parse } from 'yaml'
import { createInteractionButton, createQuizPage, listQuestions, patchInteraction, readInteraction, remapCopiedInteractions, setButtonAction } from '../client/md/interactions'
import { readComponentString, writeComponentString } from '../client/md/component-fields'
import { readTextContent } from '../client/md/elements'
import { readDrag } from '../client/md/drag'

const text = { title: 'Choose the answer', options: ['A option', 'B option', 'C option', 'D option'], correct: 'Correct!', incorrect: 'Try again.', idle: 'Choose an option.', submit: 'Confirm', clear: 'Clear' }
const canvas = { width: 960, height: 540 }
const contentProp = { name: 'contentHtml', control: 'richtext' as const }

it.each(['single', 'multiple'] as const)('creates a %s page with rule-only control and independently authored content', mode => {
  const page = createQuizPage(mode, canvas, text)
  const [question] = listQuestions(page.content)
  expect(parse(page.frontmatter)).toEqual({ layout: 'none', title: text.title })
  expect(question.value).toMatchObject({ question: 'question-1', mode, presentation: 'hidden' })
  expect(question.value.options?.[0]).toEqual({ id: 'A', correct: true })
  expect(question.value.options?.filter(option => option.correct).map(option => option.id)).toEqual(mode === 'single' ? ['A'] : ['A', 'C'])
  const blocks = page.content.split('\n\n')
  expect(blocks).toHaveLength(mode === 'single' ? 7 : 9)
  expect(blocks[0]).not.toContain('title=')
  expect(blocks[0]).not.toContain('label')
  expect(readTextContent(page.content, [2, 3])).toBe('Choose the answer')
  expect(readComponentString(page.content, [4, 5], contentProp)).toMatchObject({ value: '<p>A option</p>' })
  expect(readInteraction(page.content, [4, 5])).toMatchObject({ kind: 'button', action: mode === 'single' ? 'choose' : 'set-option', option: 'A' })
  for (let index = 0; index < blocks.length; index++) {
    const range: [number, number] = [index * 2, index * 2 + 1]
    expect(readDrag(page.content, range)?.via).toBe('attr')
    expect(readInteraction(page.content, range)?.question).toBe('question-1')
  }
  expect(readComponentString(blocks.at(-1)!, [0, 1], { name: 'idleText', control: 'text' })).toMatchObject({ value: 'Choose an option.' })
})

it('edits option content on the option and leaves rule configuration and neighbors intact', () => {
  const page = createQuizPage('single', canvas, text)
  const next = writeComponentString(page.content, [4, 5], contentProp, '<p>A &amp; 新文字</p>')
  expect(readComponentString(next, [4, 5], contentProp)).toMatchObject({ value: '<p>A &amp; 新文字</p>' })
  const beforeBlocks = page.content.split('\n\n'), afterBlocks = next.split('\n\n')
  expect(afterBlocks[0]).toBe(beforeBlocks[0])
  expect(afterBlocks.slice(3)).toEqual(beforeBlocks.slice(3))
  expect(readDrag(next, [4, 5])).toEqual(readDrag(page.content, [4, 5]))
})

it('preserves unknown rule expressions and only allows editing the fixed option set', () => {
  const dynamic = '<StudioQuestion question="q" :options="getOptions()" />'
  expect(patchInteraction(dynamic, [0, 1], { options: [] })).toBe(dynamic)
  const page = createQuizPage('single', canvas, text)
  const [question] = listQuestions(page.content)
  expect(patchInteraction(page.content, [0, 1], { options: question.value.options!.slice(0, 2) })).toBe(page.content)
})

it('remaps a copied question with its text objects, buttons and custom components', () => {
  const page = createQuizPage('multiple', canvas, text)
  const custom = '<EditableOptionCard question="question-1" option="A" />'
  const next = remapCopiedInteractions(page.content + '\n\n' + custom, page.content)
  expect(listQuestions(next)[0].value.question).toBe('question-2')
  expect(next).toContain('data-studio-question-ref="question-2"')
  expect(next).toContain('<EditableOptionCard question="question-2" option="A" />')
  expect(next).not.toContain('question="question-1"')
  expect(next).not.toContain('data-studio-question-ref="question-1"')
  expect(next.split('\n')).toHaveLength((page.content + '\n\n' + custom).split('\n').length)
  expect(remapCopiedInteractions(custom, page.content)).toBe(custom)
  const title = page.content.split('\n\n')[1]
  expect(remapCopiedInteractions(title, page.content)).toBe(title)
})

it('keeps multiline rules and ignores fenced examples and comments', () => {
  const source = '```vue\n<StudioQuestion question="example" />\n```\n\n<!-- <StudioQuestion question="comment" /> -->\n\n<StudioQuestion question="real" :options="[\n { id: \'A\', correct: true }\n]" />\n\n<StudioButton question="real" action="choose" option="A" content-html="Before" v-drag="[10,20,100,80]" />'
  expect(listQuestions(source).map(item => item.value.question)).toEqual(['real'])
  const next = patchInteraction(source, [6, 9], { options: [{ id: 'A', correct: false }] })
  expect(listQuestions(next)[0].value.options).toEqual([{ id: 'A', correct: false }])
  expect(next.split('\n')).toHaveLength(source.split('\n').length)
  expect(readDrag(next, [10, 11])).toEqual(readDrag(source, [10, 11]))
})

it('creates a local content field for inserted buttons and retains it when changing actions', () => {
  expect(createInteractionButton('# Plain slide', canvas, 'Button')).toBeNull()
  const page = createQuizPage('single', canvas, text)
  const snippet = createInteractionButton(page.content, canvas, 'New button')!
  expect(readComponentString(snippet, [0, 1], contentProp)).toMatchObject({ value: '<p>New button</p>' })
  const changed = setButtonAction(page.content, [4, 5], 'clear-pending')
  expect(readInteraction(changed, [4, 5])).toMatchObject({ action: 'clear-pending', option: '' })
  expect(readComponentString(changed, [4, 5], contentProp)).toMatchObject({ value: '<p>A option</p>' })
})
