# Portable desktop release implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Deliver offline desktop release notes, manual stable-client update discovery, and an explicit prerelease publication flow for the existing Windows ZIP.
**Architecture:** Keep release lookup and native dialogs in Electron, consume GitHub Releases read-only, and reuse the existing preparation and release CLI. One Markdown note supplies both packaged metadata and GitHub release notes.
**Tech Stack:** Existing Node/CommonJS, Electron Forge, native fetch/dialogs, Vitest; no dependency changes.
**Spec:** docs/superpowers/specs/2026-11-17-desktop-release-design.md

## Global Constraints

- Desktop 0.5.2, bundled Studio 0.5.2; preserve independent versions and existing project dependencies.
- Windows x64 portable ZIP; online required, offline optional. No installer, automatic replacement, new service or database.
- Manual checks only; fixed GitHub repository, desktop-vX.Y.Z stable releases with matching online ZIP. Follow standard pagination with a single overall timeout.
- Read local notes offline, render remote notes as plain text, open only fixed repository release pages.
- Publish new releases as prereleases, require desktop notes, never overwrite remote assets or automatically promote stability.
- Relevant existing checks; new tests cover core new behavior, no browser interaction automation. Actual packaging/publishing requires an explicit subsequent instruction.

## Review Focus

- Welcome-page read-only actions must not masquerade as dependency preparation or alter current project/process state.
- New native dialog actions retain main-window authorization and ignore destroyed windows after asynchronous lookup.
- Existing stable releases stay stable when optional offline assets are uploaded.
- Bundled desktop and editor versions remain independently recorded; no npm publication/version change in this work.
- First public release remains a prerelease until actual Windows feedback; dry runs make no external writes.

### Task 1: Release lookup and packaged metadata

**Files:** create desktop/client-release.cjs and test/desktop-release.test.ts; modify desktop/scripts/prepare.cjs, test/desktop-packages.test.ts, desktop/package.json; create docs/releases/desktop-0.5.2.md.
**Interfaces:** readDesktopRelease(root) -> {desktopVersion, studioVersion, notes}; readBundledDesktopRelease(resources) -> same; checkDesktopRelease({fetchImpl?, timeoutMs?}) -> {version, notes, url}|null; fixed RELEASES_URL exported. Reuse compareStudioVersions.

- [x] Add direct behavioral tests for stable desktop filtering and numeric ordering, subsequent pages, lookup HTTP failure, and real-file local metadata. Run new tests and observe missing behavior.
- [x] Implement small metadata/lookup module. Generate desktop-release.json from mandatory Markdown before published package preparation, retaining the prior tgz when its npm lookup fails.
- [x] Extend the existing preparation fixture with desktop manifest/notes and assert packaged metadata from the real preparation function. Update desktop version and author concise user notes.
- [x] Run `node node_modules/vitest/vitest.mjs run test/desktop-release.test.ts test/desktop-packages.test.ts`; expected: all pass. Commit Task 1.

### Task 2: Native version information and manual update entry

**Files:** create desktop/client-updates.cjs; modify desktop/main.cjs, desktop/welcome.html, desktop/welcome.js. Extend test/desktop-release.test.ts for native controller behavior only.
**Interfaces:** createClientUpdates({resources, currentVersion, dialog, shell, getWindow, check?}) -> async action('info'|'check'); calls Task 1 metadata and lookup. Native controller owns dialogs/browser navigation, not project actions.

- [x] Add focused controller tests for offline notes without lookup, explicit check/opening the selected release, and query failure/manual fixed-page fallback. Use injected Electron boundary dependencies.
- [x] Implement controller, dispatch read-only clientInfo/clientUpdate actions before project mutation guards, and add Help menu entries. Keep IPC sender checks unchanged.
- [x] Add one welcome-page version entry, clarify Studio package update wording, and isolate clicked read-only button waiting from project progress. No layout redesign or automatic check.
- [x] Run `node node_modules/vitest/vitest.mjs run test/desktop-release.test.ts test/desktop-update.test.ts test/desktop-management.test.ts`; expected: all pass. Commit Task 2.

### Task 3: Prerelease CLI, documentation and final verification

**Files:** modify scripts/release.cjs and test/release.test.ts; update desktop/README.md and docs/status.md.
**Interfaces:** releaseInfo retains existing fields; publish(info,dryRun,spawn?) remains real CLI orchestration, defaults new releases to --prerelease --latest=false, requires mandatory notes and online ZIP when creating a release. Existing uploads preserve release status.

- [x] Extend existing release tests for missing notes, default prerelease creation and preserving an existing stable release. Keep network/process doubles at the gh boundary, assert externally visible arguments/results.
- [x] Implement mandatory notes, explicit prerelease CLI option, and user-facing dry-run instructions for stable promotion. Ensure upload dry runs do not invoke gh.
- [x] Update current docs with actual scope, version semantics, manual ZIP upgrade and Windows verification still needed. Run related tests, then the full existing Vitest suite and typecheck once; syntax-check modified desktop JS and run release build/publish dry runs.
- [ ] One independent whole-branch review; fix evidenced core issues in one pass with affected checks. No repeated full verification absent a change/failure.
- [ ] Fold completed plan/design conclusions into current docs, remove completed temporary plan, retain implementation commits, and report results without packaging, publishing or merging automatically.
