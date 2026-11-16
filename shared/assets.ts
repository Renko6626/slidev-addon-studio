/** Native browser assets. An accepted container does not guarantee codec support. */
export type AssetKind = 'image' | 'video' | 'audio'
export const assetExtensions = {
  image: ['.png', '.jpg', '.jpeg', '.jfif', '.gif', '.svg', '.webp', '.avif', '.apng', '.bmp', '.ico'],
  video: ['.mp4', '.webm', '.mov', '.m4v', '.ogv'],
  audio: ['.mp3', '.wav', '.m4a', '.aac', '.ogg', '.oga', '.opus', '.flac'],
} satisfies Record<AssetKind, string[]>
export function assetKind(name: string): AssetKind | null {
  const extension = name.slice(name.lastIndexOf('.')).toLowerCase()
  return (Object.keys(assetExtensions) as AssetKind[]).find(kind => assetExtensions[kind].includes(extension)) ?? null
}
export function assetAccept(kind?: AssetKind): string {
  return (kind ? assetExtensions[kind] : Object.values(assetExtensions).flat()).join(',')
}
export function assetLimitMiB(kind: AssetKind): number { return kind === 'image' ? 32 : 128 }
