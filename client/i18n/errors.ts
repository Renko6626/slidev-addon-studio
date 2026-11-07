import type { StudioErrorCode, StudioErrorResponse } from '../../shared/errors'
import type { MessageKey } from './index'
import { t } from './index'

const errorMessages = {
  slideNotFound: 'errorSlideNotFound',
  deleteHeadmatter: 'errorDeleteHeadmatter',
  moveHeadmatter: 'errorMoveHeadmatter',
  emptyDeck: 'errorEmptyDeck',
  crossFileMove: 'errorCrossFileMove',
  moveBeforeHeadmatter: 'errorMoveBeforeHeadmatter',
  unsupportedAssetType: 'errorUnsupportedAssetType',
  assetTooLarge: 'errorAssetTooLarge',
} satisfies Record<StudioErrorCode, MessageKey>

export function serverErrorText(response: StudioErrorResponse): string {
  const code = response.code
  if (!code || !Object.hasOwn(errorMessages, code))
    return response.error
  return t(errorMessages[code as StudioErrorCode], response.params ?? {})
}
