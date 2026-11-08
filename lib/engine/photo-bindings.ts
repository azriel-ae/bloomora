export type PhotoBoundItem = Record<string, string>;

/**
 * Resolves private media URLs onto their own memory item. New lists carry itemId/photoId metadata;
 * old galleries without stable metadata retain their historical position-based fallback.
 */
export function attachMomentImages(
  items: PhotoBoundItem[],
  mediaUrls: Record<string, string>,
  legacyPhotoIds: string[] = [],
): PhotoBoundItem[] {
  const hasStableItemIds = items.some((item) => Boolean(item.itemId));
  const hasExplicitPhotoIds = items.some((item) => Boolean(item.photoId));
  return items.map((item, index) => {
    const photoId = item.photoId;
    const legacyPhotoId = !hasStableItemIds && !hasExplicitPhotoIds ? legacyPhotoIds[index] : undefined;
    const imageSrc = photoId ? mediaUrls[photoId] : legacyPhotoId ? mediaUrls[legacyPhotoId] : undefined;
    return imageSrc ? { ...item, imageSrc } : item;
  });
}
