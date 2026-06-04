export function normalizeUrl(input: string): string | null {
  try {
    const trimmed = input.trim();
    const withProtocol = /^https?:\/\//i.test(trimmed)
      ? trimmed
      : `https://${trimmed}`;
    const url = new URL(withProtocol);
    if (!["http:", "https:"].includes(url.protocol)) return null;
    return url.toString();
  } catch {
    return null;
  }
}

export const DUPLICATE_URL_MESSAGE =
  "This URL is already on your reading list.";

export function isUrlOnReadingList(
  items: { url: string }[],
  inputUrl: string,
): boolean {
  const normalized = normalizeUrl(inputUrl);
  if (!normalized) return false;
  return items.some((item) => normalizeUrl(item.url) === normalized);
}
