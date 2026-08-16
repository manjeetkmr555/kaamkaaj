import { normalizeUrl } from "@/lib/normalizeUrl";

const IMAGE_EXT = /\.(avif|bmp|gif|jpe?g|png|svg|webp)(\?.*)?$/i;

export function isLikelyImageUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return IMAGE_EXT.test(parsed.pathname);
  } catch {
    return false;
  }
}

/** Background image for a collection file card. */
export function getCollectionFilePreviewUrl(input?: {
  url?: string | null;
  previewImageUrl?: string | null;
} | null): string | null {
  if (!input) return null;
  if (input.previewImageUrl?.trim()) return input.previewImageUrl.trim();

  const normalized = input.url ? normalizeUrl(input.url) : null;
  if (!normalized) return null;
  if (isLikelyImageUrl(normalized)) return normalized;
  return null;
}
