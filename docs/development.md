# Development and configuration

[Back to documentation](README.md)

## Development

```bash
pnpm install
pnpm play        # the playground deck in playground/
pnpm test        # unit tests for the Markdown rewriting
pnpm typecheck
```

An optional service QA test edits slides over HTTP and checks compilation. It is
skipped unless `STUDIO_QA_URL` is set. Only point it at a disposable deck prepared
for that test; it writes real slide files. It is separate from browser interaction
validation and is not required for ordinary documentation or layout changes:

```bash
# Start your prepared disposable QA deck on port 3060 first.
STUDIO_QA_URL=http://localhost:3060 pnpm test
```

The Markdown rewriting lives in `client/md/` and `node/slide-source.ts` as pure
functions with no DOM or Vue involved, which is where the tests are aimed.
Anything that changes a user's file should be provable at that level first.

To try it against a real deck, link it in:

```bash
pnpm add -D "link:../slidev-addon-studio"
```

`link:` rather than `file:`, so edits reach the running dev server instead of
being copied once at install time.

## Configuration

All optional, under `studio` in the headmatter:

```yaml
---
studio:
  annotate: all         # all | html | off
  hideComponents:
    - InternalThing
---
```

`annotate` controls how much of the rendered slide carries the source
annotations Studio needs to trace a click back to Markdown:

- `all` (default): HTML elements and Vue components
- `html`: HTML elements only. Use this if a fragment-root component logs
  "extraneous non-props attributes" warnings in your console
- `off`: Markdown blocks only

Studio also respects Slidev's own `editor: false`, which disables it completely.

## How it works

Studio is an ordinary Slidev addon. It hooks into the parts of Slidev that are
already there:

| What it needs | How it gets it |
| --- | --- |
| Editor UI over the deck | `global-top.vue`, teleported to `body` |
| Toolbar button | `custom-nav-controls.vue` |
| Keyboard shortcuts | `setup/shortcuts.ts` |
| Writing to the `.md` | `useDynamicSlideInfo().update()`, the same endpoint Slidev's own editor and `v-drag` use |
| Changing frontmatter | The same endpoint, but as `frontmatterRaw` rather than a `frontmatter` patch, edited line by line so comments and key order survive. A patch updates Slidev's own resolved copy of the deck, so the file watcher then finds nothing changed and never rebuilds the slide, and a layout switch appears to do nothing until the server restarts |
| Free positioning | Slidev's `v-drag`, so positions stay compatible with Slidev's own handles |
| Component and layout catalog | `setup/vite-plugins.ts`, which receives the fully resolved options including every theme and addon root |
| Adding and reordering slides | A small dev-only API in the addon's own Vite plugin, since Slidev's endpoint only patches slides in place |
| Tracing a click to its source | A markdown-it plugin that stamps each block with the line range it came from |

That last one is a hint, not a contract. A custom `setup/transformers.ts` can
move lines before markdown-it sees them, so the client re-checks every range
against the real Markdown and finds the block again by its content when the
range does not match. If it cannot be sure, it refuses to edit and says so.
Editing the wrong lines is the one failure that would cost you a deck, and it is
worth being dull about.


## Interface language

The UI follows the browser initially and remembers the title-bar language choice
under `slidev-studio:locale`. English and Simplified Chinese messages live in
`client/i18n/en.ts` and `client/i18n/zh-CN.ts`; add matching keys and use whole
parameterized messages rather than joining translated fragments.

Studio uses its own Vue I18n Composer, preserving the host project's plugin and
`$t`. Vue I18n remains pinned to 11.4.2 for the existing Node 20 compatibility.
Built-in component labels supplied by Studio are translated; authored content,
component names, prop keys and third-party descriptions keep their source form.
Known server validation errors have localized messages while their diagnostic
English text remains available.

## Mounted projects and assets

Studio's own API requests and asset URLs use Vite's `base`, including paths such
as `/edit/<workspace>/`. HTML editing removes the mount prefix when saving media
URLs, keeping references relative to the project's public root.

`SLIDEV_STUDIO_ASSET_DIR` optionally chooses an upload subdirectory inside
`public/`; an empty value uses `public/` itself. These adaptations are part of the
fork and do not require a workbench service. Workbench repositories may have
separate Slidev adaptations; upgrading their pinned dependencies is outside an
addon source merge.

## Current modules

| Area | Files |
| --- | --- |
| Workspace, ribbon and panes | `client/ui/StudioRoot.vue`, `StudioToolbar.vue`, `StudioDock.vue`, `StudioLibrary.vue`, `StudioNotes.vue` |
| Selection and transforms | `client/composables/useSelection.ts`, `useSlideCanvas.ts`, `useTransformGizmo.ts` |
| Text boxes and pictures | `client/md/elements.ts`, `useElementProperties.ts`, `useImageInsertion.ts`, element field components |
| Object clipboard | `client/md/clipboard.ts`, `client/composables/useObjectClipboard.ts` |
| Source writes and history | `client/composables/useSlideSource.ts`, `client/actions.ts` |
| Catalog, pages and assets | `node/`, `client/composables/useDeckApi.ts` |
| Interface translations | `client/i18n/en.ts`, `client/i18n/zh-CN.ts` |

Keep source edits inspectable. New basic elements use ordinary HTML plus
`v-drag`; images remain file references under `public/`. Studio's editing UI is
dev-only, while authored content continues to render in production builds.

## Verification

Run the checks relevant to the complete change:

```bash
pnpm test
pnpm typecheck
pnpm exec slidev build playground/slides.md --out /tmp/studio-build
# When changing base-path or asset handling:
pnpm exec slidev build playground/slides.md --base /studio-preview/ --out /tmp/studio-base-build
```

`pnpm typecheck` checks the repository's TypeScript declarations and modules;
Vue template compilation is also exercised by Slidev. The November milestone
additionally used a temporary vue-tsc installation with the project's TypeScript
5.9.3 for SFC type checking, without adding a project dependency.

Add permanent tests for concrete bugs or important new behaviour. Reuse source
rewriting and geometry tests rather than asserting source strings in UI files.
Browser validation defaults to navigation and screenshots; automatic clicks,
typing and workflow tests require an explicit request. A unit-test result does
not establish that native clipboard, IME, file picker or fullscreen interactions
have been exercised.

## Distribution

`main` contains the current source. The editor workspace, new basic elements and
object clipboard described here are currently unreleased changes relative to
`0.3.1-renko.1`. A source merge does not update installed activity dependencies.

The existing CI runs tests and type checking on main pushes and pull requests.
The Release workflow publishes only on a `v*` tag and verifies the tag against
`package.json`. Updating the version, creating a release tag, publishing npm and
upgrading workbench projects are separate tasks; do not infer them from a request
to push or merge source.
