export type ReadingInsights = {
  category: string;
  summary: string;
};

const SYSTEM_PROMPT =
  'You label web articles for a reading list. Reply with JSON only: {"category":"...","summary":"..."}. Category must be 1 to 3 words (no punctuation). Summary must be 1-2 short sentences, under 200 characters, plain text.';

function clampCategory(raw: string): string {
  const words = raw
    .replace(/[^\w\s-]/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 3);

  if (words.length === 0) return "General";
  return words.join(" ");
}

function clampSummary(raw: string, maxLen = 220): string {
  const cleaned = raw.replace(/\s+/g, " ").trim();
  if (cleaned.length <= maxLen) return cleaned;
  return `${cleaned.slice(0, maxLen - 1).trim()}…`;
}

function fallbackInsights(
  url: string,
  title: string,
  description: string,
): ReadingInsights {
  const host = new URL(url).hostname.replace(/^www\./, "");

  let category = "Web Article";
  if (/news|bbc|cnn|reuters|times/i.test(host)) category = "News";
  else if (/tech|github|dev|medium/i.test(host)) category = "Tech";
  else if (/sport|espn|cricket/i.test(host)) category = "Sports";
  else if (title) category = clampCategory(title.split(/\s+/).slice(0, 2).join(" "));

  const summary = clampSummary(
    description ||
      `Article from ${host}${title ? `: ${title}` : ""}.`,
  );

  return { category: clampCategory(category), summary };
}

function parseInsightsJson(content: string): ReadingInsights | null {
  const trimmed = content.trim();
  const jsonText = trimmed.startsWith("```")
    ? trimmed.replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, "")
    : trimmed;

  try {
    const parsed = JSON.parse(jsonText) as {
      category?: string;
      summary?: string;
    };
    if (!parsed.category || !parsed.summary) return null;
    return {
      category: clampCategory(parsed.category),
      summary: clampSummary(parsed.summary),
    };
  } catch {
    return null;
  }
}

async function generateWithAnthropic(
  url: string,
  title: string,
  description: string,
): Promise<ReadingInsights | null> {
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
      max_tokens: 256,
      temperature: 0.3,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `URL: ${url}\nTitle: ${title}\nDescription: ${description || "(none)"}`,
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

  return parseInsightsJson(content);
}

export async function generateReadingInsights(
  url: string,
  title: string,
  description: string,
): Promise<ReadingInsights> {
  const ai = await generateWithAnthropic(url, title, description);
  if (ai) return ai;
  return fallbackInsights(url, title, description);
}
