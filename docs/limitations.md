# Supported boundaries and limitations

[Back to documentation](README.md)

- Editing only works while `slidev` is running with the editor enabled. A built,
  exported or printed deck contains none of Studio's editing UI.
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

- Standalone File manages the current project only. The optional Windows desktop
  host supplies creating, opening, saving a copy and closing projects. No generic
  file editor or file rename/delete operations are added. Windows native behavior
  remains subject to preview testing; the current multi-selection, layers and
  background/image-position stages have not been packaged into an updated Windows
  preview or accepted on Windows. See [desktop validation](../desktop/README.md).
- Project ZIP is a source transfer format, not an offline runtime. Dependencies
  and external assets are not embedded, and local `link:` dependencies are not
  rewritten. Source symlinks and imported Markdown outside the project must be
  moved inside before export. Archives are generated in memory; avoid editing
  the same project externally while a download is being prepared.
- The project tree omits the same local files as export: dependencies, Git
  metadata, build output, caches, `.env` values and `.npmrc`/Yarn local config.
  PDF, PowerPoint and built-site exports are not exposed by this File page.
- Save reports failed writes and stops export; it does not add automatic retry
  or recovery. Check the files and refresh after a failed write. Only applied
  text is automatically written; Ctrl/Cmd+S also applies the active text and notes.

- New text boxes and pictures have dedicated controls. Supported native prose
  also shares the text controls; no automatic document migration is performed.
- Studio text boxes support character-level fonts, sizes, colours and marks,
  paragraph alignment/spacing and lists. Height still follows content; fixed-height
  boxes, vertical alignment, text-box margins, auto-shrink and font installation
  remain future work. Images in Fill frame mode support horizontal/vertical
  `object-position` percentages and a 50%/50% centre reset. The frame and source
  image remain unchanged; draggable crop tools and editable SVG paths are not included.
- Rich text supports Studio text boxes, ordinary ATX Markdown headings and
  paragraphs, standalone HTML headings/paragraphs and generated HTML lists.
  Heading levels, document flow and existing root attributes are retained; font,
  size and colour changes use standard HTML when Markdown cannot express them.
  Editing is scoped to one block; new paragraphs become siblings. Setext headings,
  other Markdown structures, frontmatter and component internals retain their
  previous editors. Unsupported custom source markup opens as source rather than
  being silently normalised by the text schema.
  Editing-session history and the existing whole-deck history are separate: after
  applying, the text session is one deck action; reopening starts a new text history.
- On hand-authored boxes, underline/strikethrough inherited from the root or a
  theme cannot currently be removed by the local mark buttons. Ordinary new
  text boxes use local marks and are not affected; edit the root style in source.
- Object clipboard data is limited to the same origin and Vite base. Top-level
  blocks are supported; list items, nested sublists, nested HTML sub-elements and
  frontmatter-only text are not independent clipboard objects. The clipboard
  preserves each copied object's positioning and click-animation wrappers, including
  multiple independent positioned objects. It does not copy arbitrary parent
  layout or shared-group semantics.
- Clipboard managers or other applications may remove Studio's custom clipboard
  format. Copy the object again in Studio if canvas paste no longer recognises it.
- Create copy remains available for individual list items under the existing
  list-editing rules; this is separate from cross-slide clipboard copying.
- Return to flow and source-order movement are temporarily hidden in the
  ribbon, inspector and context menu. Their underlying source operations remain
  available in code; existing positioning is unchanged.
- Multiple selection supports independently positioned Studio text boxes, pictures,
  shapes and components with definite source ranges on the current slide. Shift-click
  toggles membership; dragging from empty slide space box-selects, with Shift adding
  to the selection. Batch move/copy/delete, alignment and equal-gap distribution are
  one undo step per action. Distribution needs at least three objects. Font and
  Paragraph controls are disabled during multiple selection; permanent grouping,
  batch resizing/rotation and selection across slides are not provided.
- Layers opens from View, Object or the right-hand inspector. Only supported text
  boxes, pictures and shapes within the same parent container can change order.
  Unknown components are selectable only; containers keep their own stacking
  contexts. CSS order is saved in source and retained in static builds. Backgrounds
  are excluded from object selection, box-selection, clipboard and layer lists.
- Free-canvas background colour, picture and removal controls apply to blank pages
  and pages made of independent positioned objects. Document-flow content disables
  these controls; existing layout background parameters remain separate. An effective
  change clears the object selection. Pictures fill the page from the centre; the
  background is saved as a non-interactive source element below page objects.
- Manual viewport zoom and hidden-slide management remain future work. Windows
  desktop ZIP packaging is available as a preview, without an installer, signing
  or automatic updates.
