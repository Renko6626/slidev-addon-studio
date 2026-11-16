# Quiz option editing implementation plan

> Execute inline using superpowers:executing-plans. User approved the scope and requested rapid implementation.

**Goal:** Add and remove quiz options through the existing question inspector.
**Architecture:** Keep rule arrays and standalone StudioButtons; update both in one source edit and existing commit/history operation.
**Tech Stack:** Existing Vue and TypeScript; no new dependencies.
**Spec:** ../specs/2026-11-16-quiz-option-editing-design.md

## Constraints

Preserve authored layout and remaining option IDs. No automatic answer reassignment, new framework, browser interaction tests, or unrelated changes.

## Implementation

- [x] Extend `client/md/interactions.ts` with `addQuizOption(content, range, canvas, label)` and `removeQuizOption(content, range, id)` returning updated source. Keep generic patch protection; dedicated operations own rule/button synchronization.
- [x] Add focused behavior cases to `test/interaction-source.test.ts`: both modes, removal scoped to the owning question, preservation of unrelated objects, and author-supplied dynamic configuration.
- [x] Add inspector controls in `client/ui/parts/InteractionFields.vue`, translated labels in `client/i18n/{en,zh-CN}.ts`, and small existing stylesheet adjustments.
- [x] Document source authoring and custom-component boundaries in `docs/custom-code/components.md`.
- [x] Run related Vitest files and `pnpm typecheck`; inspect the final diff.
- [x] Apply the subsequently approved desktop titlebar overlay, remove the native menu while keeping shortcuts, and expose project folder/log actions plus coding-agent guidance in the existing file page.

## Review focus

Correct action for single/multiple mode; matching only selected question/option; preserving control selection after deleting earlier buttons; empty option lists remain editable; dynamic source remains untouched.


## Verification and delivery

- `pnpm exec vitest run test/interaction-source.test.ts test/quiz.test.ts test/quiz-components.test.ts test/i18n.test.ts test/desktop-projects.test.ts test/desktop-runtime.test.ts`: 33 tests passed across 6 files.
- `pnpm typecheck`: passed.
- `pnpm --package=vue-tsc@3.1.8 --package=typescript@5.9.3 dlx vue-tsc --noEmit --project tsconfig.json`: passed; no project dependencies added.
- `node --check desktop/main.cjs`: passed.
- Vue compiler-sfc parsed and compiled all four changed SFCs successfully.
- `git diff --check`: passed.
- Bounded read-only review found preview viewport/return-button overlap; corrected through scoped CSS. No remaining blockers reported.
- No browser interaction tests, screenshots, Windows runtime validation, or desktop rebuild. Changes remain uncommitted in the current workspace.
