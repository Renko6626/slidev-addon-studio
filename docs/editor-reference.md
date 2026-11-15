# Editing reference

[Back to documentation](README.md)

The screenshots below show the upstream panel layout. The current fork uses a ribbon,
left filmstrip and right inspector; see the [current workspace](images/workspace.png).

## What it does

| Panel | What it edits |
| --- | --- |
| **Element** | Position, size, rotation, component props, utility classes, duplicate, delete, and the raw Markdown of the selection |
| **Components** | Markdown basics plus every component this deck can use, with live previews. Click to insert, drag onto the canvas to place freely |
| **Animate** | Click steps, reveal and hide, entrance animations, staggered lists and motion presets |
| **Transitions** | The effect used when leaving the current slide |
| **Page settings** | The page name and parameters used by the page's existing layout; background is offered only when that layout declares it |
| **Slide filmstrip** | Live thumbnails, drag to reorder, add, duplicate and delete |
| **Assets** | Drop images into `public/` and insert them |
| **Notes** | The current slide's speaker notes, below the canvas |

### Selecting and moving

Click anything on the slide. Studio traces the rendered element back to the
exact lines of Markdown it came from and shows them in the Element panel.

Drag a flow block to give it a free position in slide canvas units. Markdown
blocks use a `v-drag` wrapper with `pos="x,y,w,h"`; HTML elements and components
use the directive form. Handles resize, the top handle rotates, and Backspace
deletes. New text boxes expose width handles and automatic height; new pictures
have a frame-ratio lock. Return to flow and source-order controls are currently
hidden from the editor. Editing context menus contain applicable object actions
and Close Studio; Slidev presentation menus remain available outside Studio.

Elements snap to the canvas edges, its centre and thirds, and to the edges and
centres of everything else on the slide. Hold <kbd>Alt</kbd> to place something
exactly where you want it instead.

![A block being dragged across the slide, with the selection outline and handles following the pointer](framed/drag.png)

A move of an element that is already free is written straight into its `pos`,
without rebuilding the slide, so dragging stays as smooth as Slidev's own
handles. Only the first drag of a block in the document flow re-renders it,
because that one changes the Markdown's shape rather than four numbers in it.

### Editing text

Double-click a supported text block to edit it in place. Ordinary text uses the
existing visual editor where its formatting can be preserved. New text boxes
retain their complete HTML root and supported inline formatting. Complex blocks,
such as tables or fenced code, remain editable through their Markdown source.
The floating toolbar offers inline marks; Markdown mode also offers headings,
lists and quotes. Pictures are selected as objects rather than text editors.

![A paragraph being edited in place, with a formatting toolbar above it](framed/inline.png)

<kbd>Ctrl/Cmd</kbd> + <kbd>Enter</kbd> or <kbd>Esc</kbd> applies. Use the floating
toolbar's Cancel button to discard the current text edit.
<kbd>Ctrl/Cmd</kbd> + <kbd>B</kbd> and <kbd>Ctrl/Cmd</kbd> + <kbd>I</kbd> apply the usual text marks.

### Editing props

Select a component and the Element panel becomes a form for it, built from the
component's own props. Numbers are written bound (`:size="140"`), enumerated
strings plainly (`color="red"`), and options backed by image files get a picker
that shows the images.

A prop that holds records is edited as one row per entry with a field per key,
typed from the element type the component declares, so an empty list still knows
what fields it wants. A prop that holds a colour offers the deck's own palette,
read from the custom properties in your theme's stylesheets, so picking one
keeps the slide pointing at `var(--accent)` rather than freezing a hex.

![The Element panel editing a list of records as rows, with the theme's colour palette open below it](framed/element-props.png)

### Animating

Slidev's animation model is a sequence of click steps per slide, so the Animate
panel leads with that sequence and lets you scrub it.

![The Animate panel with a click scrubber and the reveal settings for the selected paragraph](framed/animate.png)

Studio writes whichever form fits the block:

```md
<!-- an element or component takes the directive -->
<Pill v-click.fade="2">Later</Pill>

<!-- a Markdown block gets a wrapper, which renders no extra element -->
<v-click>

# A heading that appears on click

</v-click>

<!-- a list can reveal one item at a time -->
<v-clicks every="2">

- One
- Two

</v-clicks>
```

### Page settings and existing layouts

Use **New slide** to choose a ready-to-edit page of text boxes and pictures.
The right sidebar edits the page name and any parameters declared by its current
layout. The old layout gallery and switcher are no longer shown. Existing
layouts keep rendering; change `layout` and other Slidev configuration in the
Markdown source when needed.

Layout parameters still use the existing forms, including list and numeric
fields. Text marked with `data-studio-prop` can also be edited on the canvas.
See [layout text metadata](components.md#text-a-layout-renders).

### Working with slides

![The Slides panel showing a live thumbnail per slide, with add, duplicate and delete](framed/slides.png)

Thumbnails are the real slide components rendered small, not captures, so they
are never out of date. Drag one to reorder, and add, duplicate or delete from
the left filmstrip.

### Inserting

![The Components panel showing the deck's own components, each tile rendering the real component](framed/components.png)

The palette starts with the plain Markdown blocks, because most of what goes on
a slide is a heading, a paragraph or a list. Below those sit every component the
deck can actually use: Slidev's builtins, the active theme, each addon, and your
own `components/` directory.

### Keyboard

| Key | Action |
| --- | --- |
| <kbd>E</kbd> | Open and close Studio |
| Double click | Edit the text of a block in place |
| Drag | Move the selection. A click on its own never repositions anything |
| <kbd>Backspace</kbd> or <kbd>Delete</kbd> | Delete the selected element |
| <kbd>Ctrl/Cmd</kbd> + <kbd>C</kbd> | Copy the selected complete object to the clipboard |
| <kbd>Ctrl/Cmd</kbd> + <kbd>V</kbd> | Paste the copied object into the current slide |
| <kbd>Ctrl/Cmd</kbd> + <kbd>D</kbd> | Create a copy directly on the current slide |
| <kbd>Esc</kbd> | Back out one layer: the drag in progress, then the text editor, then the selection |
| <kbd>Ctrl</kbd> + <kbd>Z</kbd> | Undo |
| <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>Z</kbd> | Redo |
| <kbd>Alt</kbd> (held) | Bypass snapping while dragging |
| <kbd>Shift</kbd> (held) | Keep aspect ratio, or snap rotation to 15 degrees |

Undo history lives in the page, so a reload clears it, and so does anything that
renumbers the deck: adding, duplicating, deleting, reordering or skipping a
slide. Undo replays a whole slide by its number, and after a renumbering those
numbers point somewhere else. Keep your normal source backups or version history outside Studio.

Object copy and paste work across slides served from the same presentation
entry (origin and Vite base path). Studio puts both the Markdown source and its
object metadata on the native clipboard, so adding a page and reloading the
editor does not discard the copied object. Paste selects the new object. Free
positioned objects are offset by 20 canvas units on the same page; the first
paste on another page retains the coordinates, and repeated pastes are offset.
Images reuse their existing asset paths rather than duplicating files.

Create copy is separate from clipboard copy: it immediately duplicates the
selection, offsets free positioning and selects the result. Whole top-level
blocks, components, text boxes and images support clipboard copying. Nested
sub-elements and frontmatter text are not independent clipboard objects.
Text editing and panel fields retain their normal text clipboard behaviour;
external text is not automatically inserted as an object. If an external app
replaces or strips Studio's custom clipboard format, copy the object again in
Studio before pasting it on the canvas.
