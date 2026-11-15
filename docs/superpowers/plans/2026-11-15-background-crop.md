# Page background and image position

The existing Vue/Slidev/Markdown write path remains the source of truth. Image
position is a local extension of the current inline image styles. The user
approved native, non-selectable source elements for backgrounds, rather than a
new frontmatter model and renderer. A one-line `div` (colour) or `img` (picture)
starts the page body. It uses z-index:0, above slide paint and below v-drag's 100;
the layer stage preserves ordinary object layers using class/CSS variables.
Background controls are limited to layout:none with empty content or independent
positioned roots. Existing document-flow content is never rewritten or restyled.

1. Add `object-position` to supported image styles. Expose horizontal and vertical
   percentages for `cover` images and a return-to-centre action in image properties.
   Keep replacement limited to `src`, preserving frame geometry and position.
2. Reuse `test/elements.test.ts` to verify a position change and replacement keep
   geometry, fit, styles and neighbouring content intact.
3. On background approval, implement the chosen source representation, page
   settings controls and existing asset-picker integration. Keep the background
   outside object selection/layers and coordinate the stacking contract with
   the layer work.
4. Run focused tests, existing type checking and a Slidev static build. Visual
   checks may navigate and take screenshots only; no automated interactions.

No image pixel editing, new dependencies, media service, persistent IDs, request
queues or recovery systems are included.

Verified with the focused elements, backgrounds, page-presets and pointer tests
(24 passing), `tsc --noEmit`, the existing playground's static build and a
temporary fixture built from the production background/image helpers. Screenshot
checks used navigation only: both native backgrounds rendered below the objects
in the editor, thumbnails and static presentation; the 100% horizontal crop kept
the right subject inside a rotated frame; an ordinary Markdown page displayed
disabled background controls. No browser upload, picker, click or drag flow was automated.

Integration found that prepending a background shifts ranges of selected objects
with identical root signatures. Background mutations therefore use the existing
`clearSelection` immediately before an effective commit and keep page settings
open. The image picker retains selection until the image has loaded and the
current page has been validated; cancelling the picker keeps selection intact.
The object recognition and reselection mechanisms are unchanged.

After integrating stages 1 and 2, the background regression check uses the real
multi-selection state: colour, image and removal writes all see an empty target
set at commit time; cancelling file selection preserves the group. Background,
multi-selection, layer and pointer checks pass (35 tests), as does type checking.
