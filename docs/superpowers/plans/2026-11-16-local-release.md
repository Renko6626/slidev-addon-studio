# Local release implementation plan

> Execute inline with superpowers:executing-plans, following the user's approved scope and correction to manual GitHub publishing.

**Goal:** One version, repeatable local Windows packaging, optional offline mode, explicit manual GitHub publication.
**Architecture:** A small Node CLI wraps existing preparation and Forge; existing npm tag CI remains independent.
**Stack:** Existing Node, Electron Forge, pnpm and gh.
**Spec:** ../specs/2026-11-16-local-release-design.md

- [x] Add `scripts/release.cjs` with version/build/publish commands and --offline/--dry-run where applicable. Test version synchronization and real artifact collection in `test/release.test.ts`.
- [x] Wire package commands, set both packages to 0.5.0, update docs and remove GitHub release creation from existing CI.
- [x] Run related checks, build the online ZIP once, inspect contents and verify checksum.
- [x] Remove specifically inventoried old Studio archives/checksums from sibling release directory; retain other files and projects.
- [x] Record actual output, cleanup and validation. No external publishing or Windows runtime claims.


## Results

- `pnpm exec vitest run test/release.test.ts test/desktop-projects.test.ts test/desktop-runtime.test.ts`: 10 passed.
- `pnpm typecheck`, `node --check scripts/release.cjs`, `git diff --check`: passed.
- `node scripts/release.cjs build --offline --dry-run`: selects offline preparation and distinct output names; no offline build executed this round.
- `pnpm release:build`: produced sibling `release/studio/0.5.0/Slidev-Studio-0.5.0-win32-x64-online.zip`; build log `/tmp/studio-release-0.5.0-online.log`.
- `pnpm release:publish --dry-run`: verified checksums and previewed manual gh commands without network/upload.
- Python zipfile CRC and hashlib checks passed; embedded addon tgz equals the external tgz, reports 0.5.0, contains skill and current features, and ZIP has no offline store.
- Extracted packaged app.asar using the installed @electron/asar ESM entry: desktop reports 0.5.0 and contains current titlebar/project-folder changes. Initial inspection tried a directory require unsupported by that ESM package; corrected the inspection import, no product change needed.
- Existing release workflow parses as valid YAML; retains only npm version-tag publishing. Independent bounded review found no blockers.
- Removed 10 historical Studio zip/tgz archives plus 6 checksum files, freeing 1064.1 MiB. Remaining historical screenshots/notes/patches/verification records moved to sibling `release/studio/history/`; exact deletion inventory is `history/cleanup-2026-11-16.json`. Other project outputs untouched.
- No Windows runtime validation, GitHub upload, npm publish, tag push or commit performed.
