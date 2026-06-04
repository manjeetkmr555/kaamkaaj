export type ReadingInsights = {
  category: string;
  summary: string;
};

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
  const descWords = description.split(/\s+/).filter(Boolean);

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

async function generateWithOpenAI(
  url: string,
  title: string,
  description: string,
): Promise<ReadingInsights | null> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) return null;

  const model = process.env.OPENAI_MODEL ?? "gpt-4o-mini";

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0.3,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You label web articles for a reading list. Reply with JSON only: {\"category\":\"...\",\"summary\":\"...\"}. Category must be 1 to 3 words (no punctuation). Summary must be 1-2 short sentences, under 200 characters, plain text.",
        },
        {
          role: "user",
          content: `URL: ${url}\nTitle: ${title}\nDescription: ${description || "(none)"}`,
        },
      ],
    }),
  });

  if (!res.ok) return null;

  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };

  const content = data.choices?.[0]?.message?.content;
  if (!content) return null;

  try {
    const parsed = JSON.parse(content) as {
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

export async function generateReadingInsights(
  url: string,
  title: string,
  description: string,
): Promise<ReadingInsights> {
  const ai = await generateWithOpenAI(url, title, description);
  if (ai) return ai;
  return fallbackInsights(url, title, description);
}
