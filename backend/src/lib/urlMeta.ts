const MAX_HTML_BYTES = 500_000;
const FETCH_TIMEOUT_MS = 12_000;

function isPrivateHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  if (h === "localhost" || h.endsWith(".local")) return true;
  if (h === "127.0.0.1" || h === "::1" || h === "0.0.0.0") return true;
  if (h.startsWith("10.") || h.startsWith("192.168.")) return true;
  if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(h)) return true;
  return false;
}

export function normalizeUrl(input: string): string | null {
  try {
    const trimmed = input.trim();
    const withProtocol = /^https?:\/\//i.test(trimmed)
      ? trimmed
      : `https://${trimmed}`;
    const url = new URL(withProtocol);
    if (!["http:", "https:"].includes(url.protocol)) return null;
    if (isPrivateHost(url.hostname)) return null;
    return url.toString();
  } catch {
    return null;
  }
}

function extractMeta(html: string, property: string): string | null {
  const escaped = property.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const patterns = [
    new RegExp(
      `<meta[^>]+property=["']${escaped}["'][^>]+content=["']([^"']+)["']`,
      "i",
    ),
    new RegExp(
      `<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${escaped}["']`,
      "i",
    ),
    new RegExp(
      `<meta[^>]+name=["']${escaped}["'][^>]+content=["']([^"']+)["']`,
      "i",
    ),
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) {
      return decodeHtmlEntities(match[1].trim());
    }
  }
  return null;
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ");
}

export async function fetchPageMeta(url: string): Promise<{
  title: string;
  description: string;
}> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "KaamKaaj-ReadingBot/1.0",
        Accept: "text/html,application/xhtml+xml",
      },
      redirect: "follow",
    });

    if (!res.ok) {
      throw new Error(`Could not fetch URL (HTTP ${res.status}).`);
    }

    const reader = res.body?.getReader();
    if (!reader) {
      throw new Error("Empty response from URL.");
    }

    let html = "";
    let bytes = 0;
    const decoder = new TextDecoder("utf-8");

    while (bytes < MAX_HTML_BYTES) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.length;
      html += decoder.decode(value, { stream: true });
      if (html.includes("</head>")) break;
    }

    reader.cancel().catch(() => undefined);

    const ogTitle = extractMeta(html, "og:title");
    const titleTag = html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1];
    const title = decodeHtmlEntities(ogTitle ?? titleTag ?? url);

    const description =
      extractMeta(html, "og:description") ??
      extractMeta(html, "description") ??
      "";

    return { title, description };
  } finally {
    clearTimeout(timeout);
  }
}
