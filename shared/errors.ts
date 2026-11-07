export type StudioErrorCode =
  | 'slideNotFound'
  | 'deleteHeadmatter'
  | 'moveHeadmatter'
  | 'emptyDeck'
  | 'crossFileMove'
  | 'moveBeforeHeadmatter'
  | 'unsupportedAssetType'
  | 'assetTooLarge'

export interface StudioErrorResponse {
  /** Retained for existing clients and diagnostics. */
  error: string
  code?: string
  params?: Record<string, string | number>
}

export class StudioError extends Error {
  constructor(
    public readonly code: StudioErrorCode,
    message: string,
    public readonly params: Record<string, string | number> = {},
  ) {
    super(message)
    this.name = 'StudioError'
  }
}

export function studioErrorResponse(error: unknown): StudioErrorResponse {
  const message = error instanceof Error ? error.message : String(error)
  return error instanceof StudioError
    ? { error: message, code: error.code, params: error.params }
    : { error: message }
}
