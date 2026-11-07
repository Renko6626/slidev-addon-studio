# Studio internationalization

The user chose Vue I18n for the fork's internationalization layer. Start with English and Simplified Chinese for Studio's own interface. Keep the existing Vue/TypeScript architecture and Markdown editing behavior.

Use a Studio-owned `createI18n({ legacy: false })` instance and its Composer directly, rather than installing a global plugin into the presentation's Vue app. This allows both Vue components and Slidev setup functions to share translations without claiming the host application's i18n configuration. Keep messages under `client/i18n/`, with matching TypeScript schemas.

On first use, choose Chinese for a Chinese browser locale and English otherwise. Store the user's explicit selection under a Studio-specific localStorage key. Offer English/简体中文 in the toolbar. Translate panels, fields, menus, tooltips, empty states, built-in block labels, animation labels and editor-owned errors. Preserve user content, Markdown syntax, component names, prop names and third-party metadata. Keep diagnostic server errors available in their original form.

History should retain translatable action descriptions so changing language also updates the undo tooltip. No changes to persistence, asset paths, input behavior or deployment are included.

Alternatives considered: direct Chinese replacement loses English support; a custom dictionary would require maintaining translation behavior ourselves. Vue I18n was explicitly selected by the user.

Validation: use existing tests/typecheck, add a small behavioral test for language switching and parameterized translations, compile Vue templates and check the playground build. Browser checks, if available, are screenshots only; no automated interaction flows.

## Coverage follow-up

The user requested a completeness audit and explicitly approved adding localized backend errors. Keep the existing `error` response field; attach `code` and `params` for Studio's page-operation and upload validation errors. Translate known codes on the client, preserve unknown/system errors verbatim, and retain the English message in the error cause for diagnostics. The shared error type has no Vue or translation dependency.

Translate Studio-owned builtin component labels, enumerated option labels and the `Project` origin in the UI. Use the existing component identity, source and metadata to distinguish these labels from author-provided metadata; do not change the catalog's transport schema, inserted snippets or enum values written to Markdown.
