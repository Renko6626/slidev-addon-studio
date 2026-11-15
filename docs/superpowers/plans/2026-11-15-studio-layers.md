# Studio Layers Implementation Plan

**Goal:** Select covered independent slide objects and persist their visual order without moving source blocks.

**Architecture:** Reuse DOM/source annotations and the existing selection. Keep rank calculation and exact opening-tag writes in the layer helper; keep the dock presentational. Persist a standard CSS custom property plus a class, with a tiny stylesheet included in presentation builds.

**Tech Stack:** Existing Vue, TypeScript, CSS and Vitest; no added dependencies.

**Spec:** `docs/superpowers/specs/2026-11-15-studio-layers-design.md`

## Constraints

- Only explicit independent positioned objects with exact root ranges; known basic objects can reorder only within one actual DOM parent.
- Keep source positions, click attributes and unrelated styles. No object IDs, background ordering, observers or recovery machinery.
- The parallel selection stage exports `describeTarget`; this stage does not change selection behavior.
- UI validation is limited to compilation and optional screenshots, without automated interaction.

## Tasks

- [x] Add `client/md/layers.ts` for reading/writing the rank and `client/layers.ts` for object enumeration, ordering and committing. Cover four directions, source preservation, unsupported roots and separate parents with short real DOM/source tests.
- [x] Add `styles/layers.css` and import it unconditionally in `global-top.vue`. Verify stylesheet importance survives a script rewriting inline z-index, including the presentation entry path.
- [x] Add `PanelLayers.vue`, a dock tab and ribbon entries; add matching English/Chinese labels and narrow CSS additions.
- [x] Run the relevant tests and existing full test/typecheck scripts once for the completed change; inspect diff and commit locally. Report any skipped UI verification and integration overlap.

## Verification evidence

- `node node_modules/vitest/vitest.mjs run --root /data/sunyunbo/www/better-ppt/.worktrees/studio-layers`: 268 passed, one opt-in live QA test skipped. After the final multiline-range case, the affected layer suite passed all 10 tests.
- `node node_modules/typescript/bin/tsc --noEmit`: passed. Changed Vue SFCs compiled with the existing Vue compiler.
- `node node_modules/@slidev/cli/bin/slidev.mjs build playground/slides.md --out /tmp/studio-layers-static-build`: passed; the built SlideWrapper CSS contains the layer rule.
- A standalone static Chromium document loaded the real stylesheet, overlapped two transformed absolute elements and simulated `el.style.zIndex = '100'`. Computed z-index remained `101` and `elementFromPoint` returned the managed object. No application interaction or automated clicking was performed.
- The pnpm wrapper tried a dependency-status reinstall because node_modules is shared through a worktree symlink; it stopped at its no-TTY guard. Verification used the same installed Vitest, TypeScript and Slidev executables directly, without installing or changing dependencies.

## Integration check

Rebased the stage onto the accepted stage-1 commit `9b11787`. Kept the multi-selection controls, state and describeTarget export. The only conflicts joined the appended translations/styles and preserved the existing selection helper. Ordering is disabled for multi-selection; choosing an item in the list returns to single selection.

After integration and the local gate adjustment: layer, i18n and multiselect suites passed 22 tests; the merged pointer-interaction suite had separately passed 13 tests. TypeScript passed and the changed toolbar/layer-panel Vue scripts and templates compiled. The prior full-suite/static-build checks were not repeated because these integration edits affect only the narrow selection gate, appended labels and styles.
