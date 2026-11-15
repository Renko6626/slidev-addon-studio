# Question interaction integration

The approved question specification remains the scope. Studio mode synchronises
the runtime editing flag on load and only crosses a session boundary when the
editing boolean changes. Moving from preview to fullscreen keeps the same trial.
No third-party script lifecycle is managed.

Question titles and button text use the existing visual hold/apply/release path,
with the source helper's concrete text descriptor. An option button without a
label writes its owning question's option label. Plain property text has no
Markdown switch or rich-text formatting. Opening and closing without changing
the rendered text preserves the source, including whitespace.

Copy retains the current envelope and MIME. A group is combined before question
IDs are remapped; it is split using each original envelope's unchanged line count
and inner range. This preserves selection inside existing drag/click wrappers.
A single button keeps its current question. Known question, button and feedback
roots use the existing layer saving rules, with dynamic style/class still denied.
Their labels use the authoring panel's translations; other components keep theirs.

The runtime directory is included in the package files and TypeScript inputs.
Slidev context declarations cover the runtime's actual page/context refs.

Integrated against `5b2989144a31d31e32a9da410af59d8c40ff46b4`, including the final
button action defaults and feedback idle-text helpers. Focused validation:

- `vitest run test/editor-mode.test.ts test/interaction-inline-editor.test.ts
  test/object-clipboard.test.ts test/clipboard.test.ts test/multiselect.test.ts
  test/layers.test.ts test/quiz-components.test.ts`: 39 passed.
- `tsc --noEmit` and `git diff --check`: passed.

The real Vue editor tests confirm option-label writeback and unchanged whitespace
without a source rewrite. The runtime factory plus Studio mode watchers confirm
page retention and trial boundaries; clipboard events confirm group rebinding
and standalone button links. The existing Vue SFC compiler fixture is shared
between runtime component checks and editor checks, without a new dependency.
No browser interactions or answers were automated. The final full check and
actual template build/screenshots belong to the main agent's combined acceptance.
