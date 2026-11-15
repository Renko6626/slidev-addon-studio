# Desktop Preparation Progress Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans inline. This is a local extension of the existing status event, with no architecture/dependency change.

**Goal:** Show live installation activity and an indeterminate progress bar on the desktop welcome page.

**Architecture:** Forward pnpm lines through the existing runtime onStatus callback as optional detail; render stage, elapsed time and progress in the existing welcome page.

**Tech Stack:** Existing Electron, Node readline, plain HTML/CSS/JS, Vitest.

**Spec:** `docs/superpowers/specs/2026-11-15-desktop-preparation-progress-design.md`

## Global Constraints

- No new dependencies, channels, retry/recovery mechanisms or percent estimates.
- Preserve current project creation, install and editor startup behavior.
- Browser checks are initialized screenshots only; no automatic interactions.
- No packaging, publishing, branch changes or unrelated question-control edits. The user's later checkpoint request authorizes committing and pushing the current feature branch.

## Review Focus

- Split process output must arrive as complete lines (real child-process test).
- pnpm output and errors still reach the existing log (same runtime test).
- Viewing logs must not clear the welcome page's busy state (code review).
- Repeated status updates must not restart the elapsed timer (code review/screenshot setup).
- Failure and completion must stop progress and enable project buttons (existing handler paths, initialized screenshots).

### Task 1: Forward real dependency activity

**Files:** `desktop/runtime.cjs`, `desktop/main.cjs`, `test/desktop-runtime.test.ts`.

**Interfaces:** Existing status objects retain message/logPath and add optional `detail`; no new IPC channel.

- [x] Add one real child-process output test, observe its failure, then forward complete pnpm lines and readable package counts through onStatus.
- [x] Show creation, dependency preparation and startup stage messages through the existing callback.

### Task 2: Welcome progress and checks

**Files:** `desktop/welcome.{html,css,js}`, `desktop/README.md`, `docs/status.md`.

- [x] Display an indeterminate progress bar, elapsed time and latest detail only while working; preserve busy state when viewing logs.
- [x] Run affected desktop tests, script syntax and TypeScript checks; inspect screenshots of working/error states without interaction.
- [x] Record scope, evidence and unverified Windows behavior.

## Evidence

The existing runtime/project files passed all 6 tests, including a real subprocess that splits a progress line across writes. Script syntax, `pnpm typecheck` and diff whitespace checks passed. Initialized installation/error/idle screenshots had no browser errors; working state shows elapsed time and keeps logs enabled, while terminal states hide progress and enable project actions. One bounded independent read-only review found no blocking defects. No full network install, packaging, Windows acceptance or browser interaction automation was performed.
