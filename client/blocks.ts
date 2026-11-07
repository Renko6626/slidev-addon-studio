import type { MessageKey } from './i18n'

/**
 * The plain Markdown building blocks.
 *
 * The palette is otherwise a list of components, which leaves no way to add a
 * heading or a paragraph without typing Markdown. These sit above the
 * components and insert exactly what you would have written by hand.
 */
export interface BasicBlock {
  labelKey: MessageKey
  name: string
  description: string
  /** Markdown inserted into the slide. */
  snippet: string
  /** A short sample rendered in the card, since these have no component. */
  sample: string
}

export const BASIC_BLOCKS: BasicBlock[] = [
  {
    labelKey: 'blockHeading',
    name: 'Heading',
    description: 'A section heading',
    snippet: '## Heading',
    sample: '## Heading',
  },
  {
    labelKey: 'blockText',
    name: 'Text',
    description: 'A paragraph',
    snippet: 'Some text.',
    sample: 'Some text.',
  },
  {
    labelKey: 'blockList',
    name: 'List',
    description: 'A bullet list',
    snippet: '- First point\n- Second point\n- Third point',
    sample: '- First point',
  },
  {
    labelKey: 'blockNumberedList',
    name: 'Numbered list',
    description: 'An ordered list',
    snippet: '1. First step\n2. Second step',
    sample: '1. First step',
  },
  {
    labelKey: 'blockQuote',
    name: 'Quote',
    description: 'A block quote',
    snippet: '> Something worth quoting.',
    sample: '> Something worth…',
  },
  {
    labelKey: 'blockDivider',
    name: 'Divider',
    description: 'A horizontal rule',
    // Not `---`, which Slidev reads as a slide separator.
    snippet: '***',
    sample: '***',
  },
  {
    labelKey: 'blockImage',
    name: 'Image',
    description: 'An image from public/',
    snippet: '![Alt text](/image.png)',
    sample: '![Alt text](…)',
  },
  {
    labelKey: 'blockCode',
    name: 'Code',
    description: 'A fenced code block',
    snippet: '```ts\nconst answer = 42\n```',
    sample: '```ts',
  },
  {
    labelKey: 'blockTwoColumns',
    name: 'Two columns',
    description: 'A side by side layout',
    snippet: '<div class="grid grid-cols-2 gap-8">\n\n<div>Left</div>\n\n<div>Right</div>\n\n</div>',
    sample: 'Left | Right',
  },
]
