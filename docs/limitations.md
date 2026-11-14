# Supported boundaries and limitations

[Back to documentation](README.md)

- Editing only works while `slidev` is running with the editor enabled. A built,
  exported or printed deck contains none of Studio.
- Slides imported from another file with `src:` can be reordered only within
  their own file.
- The first slide of the entry file cannot be deleted or moved: its frontmatter
  is the deck's global configuration.
- Components Slidev generates rather than authors write, such as `Monaco`,
  `Mermaid` and `PlantUml`, are left out of the palette: they take a compressed
  payload, so a hand-written tag cannot render. Write the fenced code block
  instead and Slidev emits them for you.
- A component whose template has several root nodes is left out too. Vue drops
  fallthrough attributes on a fragment root, so such a component can never carry
  the annotation that makes it selectable.
- Prop extraction understands `defineProps` and the Options API. Anything more
  exotic simply shows no props; the component still works, and a `<studio>`
  block can describe the props by hand.
- An element nested inside a block of raw HTML can be selected, styled, animated
  and deleted, but not reordered or duplicated on its own: it shares a Markdown
  block with its siblings.
- Classes on a Markdown block use MDC's trailing `{.class}`, which attaches to
  the last element on the line. That is the block itself for a one-line
  paragraph or heading, so those are offered. A list, a quote and a paragraph
  written across several lines are not: the class would land on the last
  `<li>`, or inside the quote, or on a `<span>` around the last few words.
  Wrap the block in a `<div>` to style it as a whole.
- Two blocks that are byte for byte identical cannot be told apart if the line
  hint is ever wrong. Studio says so and refuses rather than picking one.
- Slidev's normal navigation controls are hidden while Studio is open and
  restored when it closes. Clipboard and object-editing shortcuts yield to text
  inputs and to the presentation when Studio is closed.
- Skipping a slide is a one way door from inside the editor. Slidev drops hidden
  slides from the deck, so the slide loses its number and nothing can reach it
  again: delete `hide: true` in the Markdown to bring it back.
- Adding, duplicating, deleting or reordering a slide reloads the page. Slidev's
  own reload only refreshes slides it already knows, so a new slide would
  otherwise come back rendering whatever used to carry its number.
- Content a component renders from *other* slides, such as `<Toc>`, carries
  those slides' own annotations. Clicking an entry there selects nothing:
  its lines belong to a different slide, and following them would edit it.
- A usage example that abbreviates, such as `:items="[{ … }, …]"`, is still
  inserted as the snippet but cannot be previewed, since it is not valid
  JavaScript. Add `preview:` to the `<studio>` block to give the palette
  something it can render.
- If your project sets `slidev.markdown.markdownSetup` in its own Vite config,
  it replaces the addon's and click-to-select stops working. Studio warns on
  startup. Call `studioMarkdownSetup(md)` from your setup to restore it:

  ```ts
  import { studioMarkdownSetup } from 'slidev-addon-studio/node/markdown-source'

  export default {
    slidev: {
      markdown: {
        markdownSetup(md) {
          studioMarkdownSetup(md)
          // your own plugins here
        },
      },
    },
  }
  ```


## Current editor boundaries

- New text boxes and pictures have dedicated controls; existing unmarked content
  keeps its original editing paths. No automatic document migration is performed.
- Text box height follows its content. Arbitrary per-character fonts, font
  installation, interactive image cropping and editable SVG paths are not included.
- Object clipboard data is limited to the same origin and Vite base. Top-level
  blocks are supported; list items, nested sublists, nested HTML sub-elements and
  frontmatter-only text are not independent clipboard objects. The clipboard
  preserves single-object positioning and click-animation wrappers, not arbitrary
  parent layout or shared-group semantics.
- Clipboard managers or other applications may remove Studio's custom clipboard
  format. Copy the object again in Studio if canvas paste no longer recognises it.
- Create copy remains available for individual list items under the existing
  list-editing rules; this is separate from cross-slide clipboard copying.
- The new-element inspector hides Return to flow, while the generic Object tab
  and context menu still offer it. Using that command removes free positioning
  and its frame dimensions. Entry visibility is a known minor follow-up.
- Multiple selection, grouping, a general layer stack, manual viewport zoom,
  hidden-slide management and desktop packaging remain future work.
