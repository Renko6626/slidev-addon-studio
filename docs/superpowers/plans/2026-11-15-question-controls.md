# Question Controls Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement this plan in the current session. User confirmation already covers the design; do not repeat the approval question.

**Goal:** Separate question configuration from the prompt and show their relationship in Studio.

**Architecture:** StudioQuestion is always the registering control, hidden in presentation by default. StudioQuestionTitle renders the bound prompt, and an editor-only overlay draws relations; continue storing static props in Markdown.

**Tech Stack:** Existing Vue 3, TypeScript, Slidev, Vitest. No dependencies added.

**Spec:** `docs/superpowers/specs/2026-11-15-question-controls-design.md`

## Global Constraints

- Preserve the existing Markdown/runtime architecture. Use the new control/prompt model directly without legacy rendering or migration logic.
- No automatic layout grouping, flow graph, new persistence, or cascade deletion.
- Browser validation is navigation/read-only screenshots only.
- No packaging, publishing or merging. The user's later checkpoint request authorizes committing and pushing the current feature branch.
- Work inline in the current clean feature checkout; no unrelated branch changes.

## Review Focus

- Hidden control must remain registered in static presentation (component test).
- Removing a title must leave its question usable (same component test).
- Editing a bound title and copying its controller must target the right source (source tests).
- StudioQuestion without presentation defaults to a hidden management control; the existing combined-prompt assertion is removed with that rendering mode.
- Relation lines must be limited to the active slide/selection and not intercept input (source review and screenshot).

### Task 1: Source and runtime contract

**Files:** `shared/quiz.ts`, `components/StudioQuestion.vue`, new `components/StudioQuestionTitle.vue`, `client/md/interactions.ts`, `test/quiz-components.test.ts`, `test/interaction-source.test.ts`.

**Interfaces:** Question configuration gains optional `title`; sources gain `TitleSource`, question `presentation`/`name`. `readInteractionText` resolves a title to its control. Templates contain one independent control and a bound title.

- [x] Extend the existing critical source/component cases; run the source tests to observe the new behavior missing.
- [x] Implement control visibility without unregistering, separate prompt rendering, source reading/writing, template generation and copied-title remapping.
- [x] Run affected tests once the complete contract is implemented.

### Task 2: Editor integration

**Files:** `client/ui/parts/InteractionFields.vue`, new `client/ui/QuestionRelations.vue`, `client/ui/StudioRoot.vue`, `client/ui/StudioToolbar.vue`, `client/ui/InlineEditor.vue`, `client/actions.ts`, `client/composables/useSelection.ts`, `client/i18n/{index,en,zh-CN}.ts`.

**Interfaces:** Relation overlay consumes existing selection/current-slide DOM. Inspector updates presentation/name through existing commits and selects controls through existing source ranges. Deletion shares one warning function across menu/keyboard paths.

- [x] Add inspector settings, title bindings and go-to-control command; keep control selection out of text editing.
- [x] Draw selection-scoped dashed lines in the editor overlay.
- [x] Warn before removing controls; retain child components and use existing undo.

### Task 3: Examples, docs and verification

**Files:** `playground/interactions.md`, `README.md`, `docs/{components,usage.zh-CN,status}.md`, this plan.

- [x] Update the demo and current authoring docs.
- [x] Run `pnpm test`, `pnpm typecheck`, Vue SFC typecheck, and build the question demo to a temporary output.
- [x] Inspect editor relations/settings and static hidden presentation through screenshots only; summary visibility is verified by the real component test, without browser interaction.
- [x] Review the final diff and record actual evidence and remaining limitations. Leave changes in the current checkout for review.

## Completion record

Final tests: 314 passed, 1 existing QA skipped. TypeScript, Vue SFC typecheck and static question-demo build passed. Editor screenshots show 6 links for the control and 1 for its prompt; static output has no editor or relation overlay and keeps prompt/option text with a hidden control.

One independent bounded read-only review found the new button/feedback DOM relation attributes referred to same-named computed question objects. Existing component assertions reproduced `[object Object]` instead of the question ID; both bindings now use `props.question` and the final suite passes. No further blocking findings.

User direction: this is an early-stage project; remove the combined-prompt compatibility mode. StudioQuestion always acts as a management control with default `presentation='hidden'`, while StudioQuestionTitle renders its prompt. No automatic migration or legacy rendering is retained.

After this simplification, the affected six existing test files passed (40 tests); TypeScript, Vue SFC typecheck and the question-demo static build passed again. No new tests or repeated browser checks were added for the deletion of compatibility code.

Implementation introduced no dependencies, packaging, publishing, branch changes or browser interaction automation. The user's later request authorizes a checkpoint commit and push. Windows and real pointer/keyboard use remain for manual trial.
