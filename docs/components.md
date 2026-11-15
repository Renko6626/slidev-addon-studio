# Component and layout metadata

[Back to documentation](README.md)

## Teaching Studio about your components

Any component Slidev can resolve appears in the palette automatically. Two
things happen without you writing a line of configuration:

**The usage example in the component's doc comment becomes the snippet.** A
component documented like this:

```ts
/**
 * BigCount - the talk's signature beat, a number that counts up on reveal.
 *
 *   <BigCount :to="138723" label="Enheter" />
 */
```

is inserted as `<BigCount :to="138723" label="Enheter" />`, with real values, and
previewed with them. That beats anything synthesised from prop types, and it is
something most well-documented components already have.

**Props are read from `defineProps`.** Types drive the controls: a string union
becomes a dropdown, a number gets bound, a boolean gets a toggle.

For anything more, add a `<studio>` block to the component. It is a custom SFC
block holding plain YAML, so editors keep highlighting the file as Vue:

```html
<studio lang="yaml">
description: One of the site's mascot illustrations
category: Brand
props:
  name:
    label: Mascot
    options:
      files: ../assets/mascots/*.svg
      exclude: '*-stroke.svg'
  stroke:
    label: Light on dark
  palette:
    control: color[]
</studio>
```

| Key | Meaning |
| --- | --- |
| `description` | One line shown under the name; defaults to the first line of the doc comment |
| `category` | Groups the component in the palette; defaults to its package |
| `snippet` | Markup inserted when the component is picked |
| `preview` | Markup rendered in the thumbnail; defaults to the snippet, or `false` to skip |
| `hidden` | Keep the component out of the palette entirely |
| `props.<name>.label` | Human label for the inspector |
| `props.<name>.hidden` | Keep the prop out of the inspector |
| `props.<name>.options` | A list of values, or `{ files, exclude }` globs |
| `props.<name>.control` | Force a control: `text`, `number`, `boolean`, `select`, `list`, `color`, `color[]` |
| `props.<name>.fields` | For a list of records, the fields each row gets; inferred from the declared element type when omitted |

Controls are otherwise inferred. A string union gets a dropdown, a number is
written bound as `:size="140"`, and an array gets an editor matched to what it
holds:

- a list of strings becomes rows with add, remove and reorder
- a list of records, such as a timeline's entries or a terminal demo's steps,
  becomes a row per entry with a field per key, typed from the element type the
  component declares, so an empty list still knows what fields it wants
- values that look like colours get swatches and a picker, which resolves a
  theme variable such as `var(--flag-red)` to what it currently paints

Colours are also inferred from the values themselves, so a palette prop is a
colour editor without being declared. `control: color` or `control: color[]`
covers a prop that has no value yet.

The colours offered are your deck's own. Studio reads the custom properties
declared globally in the stylesheets your theme, addons and deck already ship,
so choosing one writes `var(--accent)` rather than a hex that stops following
the theme. A property declared inside a component's own rule is left out, since
it resolves to nothing at the slide root.

Layouts are read the same way. A layout's props are the frontmatter keys it
understands, so a slide like `layout: fact`, whose entire visible text lives in
`value:` and `label:`, is edited under Page settings rather than on the canvas.

The `files` glob is resolved against the component's own directory, so a
component that ships a folder of assets can offer them as choices with nothing
hardcoded in the editor. When the files are images, the inspector shows a
picker of the images themselves. [playground/components/Shape.vue](../playground/components/Shape.vue) is a working
example of exactly that.

## Text a layout renders

A layout is handed some of its words as frontmatter: a `title`, an `eyebrow`, a
speaker's `name`. Those words are not in the slide's body, so there is no line
of Markdown behind them and Studio cannot find them the way it finds a
paragraph. Mark them and it can:

```vue
<h1 data-studio-prop="title">{{ title }}</h1>
```

The element is then selectable on the canvas and editable in place, and what is
typed is written back to that frontmatter key. A value is a plain string, so the
formatting controls are not offered on one, and it opens with the whole value
selected the way a title placeholder does.

Keys holding a list rather than a string, such as an agenda's `items`, stay in
Page settings, where they are edited as rows.


## Built-in editable shapes

`StudioShape` is shipped in this addon's `components/` directory. It renders in
presentations and static builds without the editor. Use the Shapes menu for
insertion; it is hidden from the generic component palette to avoid duplicate
entries. `playground/shapes.md` contains working examples.

The public props are `kind` (`rect`, `ellipse`, `triangle`, `diamond`, `hexagon`,
`line`, `arrow`), `fill`, `stroke`, `stroke-width`, `dash` (`solid`, `dashed`,
`dotted`), `radius` in px, `head` and `shaft` as fractions, and boolean
`start-arrow` / `end-arrow`. Use bound numeric and boolean props. The editor
reads literal values; dynamic expressions should be edited in source.

The component measures its rendered frame to draw its geometry, so `v-drag`
remains the single source for position and size. A line runs horizontally in
its local frame; its frame rotation controls direction. Shared geometry lives
in `shared/shapes.ts`, independently of editor state.


## Question interactions

Use Insert's question-page and button commands for ordinary authoring. The
single-/multiple-choice templates keep four options; the first-version form
edits their text and answers without adding/removing options or switching types.
The three components are hidden from the generic palette to avoid unbound copies.
[playground/interactions.md](../playground/interactions.md) is a complete example.

| Component | Static props and role |
| --- | --- |
| `StudioQuestion` | `question`, `mode` (`single` / `multiple`), `title`, `options` (`{ id, label, correct }[]`), `correctText`, `incorrectText`, `idleText`; registers the question and renders its prompt |
| `StudioButton` | `question`, `action`, optional `option` and `label`; without `label`, option buttons use the question's option text. Appearance: `fill`, `color`, `selectedFill`, `correctFill`, `incorrectFill`, numeric `radius` |
| `StudioFeedback` | `question`, optional `effect` (`none` / `fade` / `pop`, default `fade`); renders the question's idle or result text |

They are independent single-root objects positioned with `v-drag`; presentation
state stays in memory. Double-click/F2 edits plain prompt/button/option text and
the feedback's idle text. Correct/incorrect messages are configured in properties.
Button appearance previews do not dispatch answers.

Advanced code can import the same signal entry used by the buttons. With the
`slidev-addon-studio` package alias installed, call this from a control after the
main slide has mounted:

```ts
import { dispatchInteraction } from 'slidev-addon-studio/runtime/interactions'

export function chooseA() {
  return dispatchInteraction({ question: 'question-1', action: 'choose', option: 'A' })
}
```

Use the current page's `question` id and an option id from that question. The
example deck uses `question-1` on both pages: ids are unique within a page, while
page instances keep separate state. For a multiple-choice page, send explicit
selection values and then submit:

```ts
dispatchInteraction({ question: 'question-1', action: 'set-option', option: 'A', selected: true })
dispatchInteraction({ question: 'question-1', action: 'set-option', option: 'C', selected: true })
dispatchInteraction({ question: 'question-1', action: 'submit' })
// Remove choices and feedback:
dispatchInteraction({ question: 'question-1', action: 'clear-pending' })
```

Only the active main slide outside editing accepts signals. Thumbnails, next-page
previews, presenter auxiliary views and print instances do not answer. The entry
returns `false` for rejected signals; it does not queue them or broadcast window
events. Leaving a slide retains its state for the current trial; crossing the
editing boundary resets the trial. Static builds use the runtime without Studio's
editing code. No network transport or lifecycle management for arbitrary
third-party scripts is supplied.
