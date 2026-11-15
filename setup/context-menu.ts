import { t, targetLabel } from '../client/i18n'
import type { ContextMenuItem } from '@slidev/types'
import type { ComputedRef } from 'vue'
import { computed } from 'vue'
import {
  canReorder,
  deleteBlock,
  duplicateBlock,
  editText,
  freePosition,
  isPositioned,
} from '../client/actions'
import { studioContext } from '../client/context'
import { selection, studioOpen } from '../client/state'

/**
 * Right-click on the canvas.
 *
 * Editing shows only applicable object actions and an exit command. Slidev's
 * presentation menu stays available outside Studio.
 *
 * Nothing here is new behaviour: every item calls the same function the Element
 * panel calls, so the menu cannot drift away from the panel.
 *
 * Studio is an authoring tool, and a built deck is not being authored. Slidev
 * gates the panel and the toolbar button on `__DEV__` already; the menu has to
 * gate itself, or a published deck offers to open an editor that was never
 * bundled with it.
 */
const authoring = __DEV__ && __SLIDEV_FEATURE_EDITOR__

export default (items: ComputedRef<ContextMenuItem[]>): ComputedRef<ContextMenuItem[]> => {
  if (!authoring)
    return items

  return computed(() => {
    const slidev = items.value

    if (!studioOpen.value) {
      return [
        ...slidev,
        'separator',
        {
          icon: 'i-carbon:pen',
          label: t('openStudioMenu'),
          action: () => (studioOpen.value = true),
        },
      ]
    }

    const studio = studioContext.value
    const target = selection.value
    const close: ContextMenuItem = {
      icon: 'i-carbon:close',
      label: t('closeStudioMenu'),
      action: () => (studioOpen.value = false),
    }

    // Studio is open but nothing is selected, or the block could not be traced
    // back to the Markdown, in which case none of these could be honoured.
    if (!studio || !target?.range) {
      return [close]
    }

    const positioned = isPositioned(studio.content(), target.range)

    // `label` is what the selection badge shows: `H1`, `Text`, `<Pill>`. As a
    // heading in a sentence "Edit h1" reads badly and "Edit <Pill>" reads fine,
    // so a heading is named for what it is.
    const name = target.kind === 'heading' ? t('kindHeading') : targetLabel(target)

    const mine: ContextMenuItem[] = []
    if (target.element !== 'image' && target.element !== 'shape') {
      mine.push({
        icon: 'i-carbon:text-annotation-toggle',
        label: t('editTarget', { name }),
        action: () => editText(),
      })
    }
    if (!positioned) {
      mine.push({
        icon: 'i-carbon:move',
        label: t('freePosition'),
        action: () => freePosition(studio, target),
      })
    }
    mine.push(
      {
        icon: 'i-carbon:copy',
        label: t('duplicate'),
        action: () => duplicateBlock(studio, target),
        disabled: !canReorder(target),
      },
      {
        icon: 'i-carbon:trash-can',
        label: t('deleteTarget', { name }),
        action: () => deleteBlock(studio, target),
      },
    )

    return [...mine, 'separator', close]
  })
}
