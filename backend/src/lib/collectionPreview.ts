import { fetchPageMeta, normalizeUrl } from "./urlMeta.js";

const IMAGE_EXT = /\.(avif|bmp|gif|jpe?g|png|svg|webp)(\?.*)?$/i;

const SYSTEM_PROMPT =
  'You write short image-generation prompts for soft card backgrounds. Reply with JSON only: {"prompt":"..."}. The prompt must be under 110 characters, visual and atmospheric, with no text or logos in the image, matching the linked content.';

function isLikelyImageUrl(url: string): boolean {
  try {
    return IMAGE_EXT.test(new URL(url).pathname);
  } catch {
    return false;
  }
}

function buildPollinationsUrl(prompt: string, seed: string): string {
  const clean = prompt.replace(/\s+/g, " ").trim().slice(0, 140);
  const encoded = encodeURIComponent(clean);
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return `https://image.pollinations.ai/prompt/${encoded}?width=640&height=420&nologo=true&seed=${hash % 100000}`;
}

function fallbackPrompt(
  name: string,
  title: string,
  description: string,
  notes: string | null,
): string {
  const bits = [name, title, notes, description]
    .map((part) => part?.trim())
    .filter(Boolean)
    .slice(0, 2)
    .join(", ");
  return bits
    ? `Soft abstract background inspired by ${bits}`
    : "Soft abstract pastel workspace background";
}

async function promptWithAnthropic(input: {
  name: string;
  url: string | null;
  notes: string | null;
  title: string;
  description: string;
}): Promise<string | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) return null;

  const model =
    process.env.ANTHROPIC_MODEL?.trim() ?? "claude-sonnet-4-20250514";

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      max_tokens: 120,
      temperature: 0.4,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `Name: ${input.name}\nURL: ${input.url ?? "(none)"}\nNotes: ${input.notes ?? "(none)"}\nTitle: ${input.title || "(none)"}\nDescription: ${input.description || "(none)"}`,
        },
      ],
    }),
  });

  if (!res.ok) return null;

  const data = (await res.json()) as {
    content?: { type: string; text?: string }[];
  };
  const content = data.content?.find((block) => block.type === "text")?.text;
  if (!content) return null;

  const trimmed = content.trim();
  const jsonText = trimmed.startsWith("```")
    ? trimmed.replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, "")
    : trimmed;

  try {
    const parsed = JSON.parse(jsonText) as { prompt?: string };
    const prompt = parsed.prompt?.trim();
    return prompt || null;
  } catch {
    return null;
  }
}

export async function resolveCollectionPreviewImage(input: {
  name: string;
  url: string | null;
  notes: string | null;
}): Promise<string | null> {
  const normalizedUrl = input.url ? normalizeUrl(input.url) : null;

  if (normalizedUrl && isLikelyImageUrl(normalizedUrl)) {
    return normalizedUrl;
  }

  let title = "";
  let description = "";
  if (normalizedUrl) {
    try {
      const meta = await fetchPageMeta(normalizedUrl);
      title = meta.title;
      description = meta.description;
      if (meta.image) return meta.image;
    } catch {
      // Fall through to Anthropic / thumbnail.
    }
  }

  if (!normalizedUrl && !input.notes?.trim() && !input.name.trim()) {
    return null;
  }

  const prompt =
    (await promptWithAnthropic({
      name: input.name,
      url: normalizedUrl,
      notes: input.notes,
      title,
      description,
    })) ?? fallbackPrompt(input.name, title, description, input.notes);

  return buildPollinationsUrl(
    prompt,
    `${input.name}|${normalizedUrl ?? ""}|${input.notes ?? ""}`,
  );
}
