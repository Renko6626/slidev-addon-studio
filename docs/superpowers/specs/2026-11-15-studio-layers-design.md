# Studio object layers

The approved second stage adds a current-slide object list that can select covered objects and move an independent object forward, backward, to the front or to the back. It does not reorder Markdown, clicks or document flow. Backgrounds, locking, hiding, persistent groups and object IDs are outside this stage.

The user approved CSS layers on independent objects sharing the same actual DOM parent. Known text boxes, images and the single-root StudioShape component are supported. Other positioned components can be selected from the list but cannot be reordered until their root/attribute semantics are known. Bound styles and ambiguous ranges remain unsupported.

## Approaches

1. Save the rank in the object's existing style and use a tiny presentation CSS rule (recommended and approved).
2. Save an important UnoCSS z-index class. This also survives Slidev, but depends on utility extraction and configuration.

Slidev's v-drag writes `el.style.zIndex = 100` on changes to coordinates and rotation. A CSSStyleDeclaration experiment confirmed that this also removes an existing inline `!important`. Therefore option 1 saves `--studio-z-index` in the style, adds the `studio-layer-object` class, and loads `.studio-layer-object { z-index: var(--studio-z-index) !important }` through global-top in editing, presenting and static builds. The root agent confirmed this implementation detail under the approved CSS approach. No observer or runtime repair is needed.

The list orders by the saved rank (or actual computed z-index before the first edit), then DOM order. A reorder writes consecutive ranks starting at 100 to supported peers in the same DOM parent, preserving positions and all unrelated source. A v-drag root creates a stacking context through its transform, so objects in separate parents are never moved across each other. Background markers are excluded and remain below normal objects at z-index 0.

The dock gains a Layers tab with a front-to-back object list and four ordering buttons. The View and Object ribbons open it. Selection uses the existing main selection so covered objects work with normal object controls and the parallel multiselect stage can keep its existing single-selection contract.

After integration with the multi-selection stage, the four ordering buttons are disabled while several objects are selected. The panel asks the user to select one object from its list; that existing single-selection assignment collapses the temporary group. Batch layer ordering is not part of this stage.
