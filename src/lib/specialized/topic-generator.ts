import {
  allowTemplateFallback,
  chatCompletion,
  isLlmEnabled,
} from "../llm-client";
import { stripPromptArtifacts } from "../prompt-cleanup";
import { buildTemplateTopicList } from "./scene-pools";
import type { TopicGenerateResult, TopicOptions } from "./types";

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function parseTopicLines(raw: string, count: number): string[] {
  const cleaned = stripPromptArtifacts(raw);
  const lines = cleaned
    .split(/\r?\n/)
    .map((line) =>
      line
        .replace(/^\s*[\d]+[.)]\s*/, "")
        .replace(/^\s*[-*•]\s*/, "")
        .trim(),
    )
    .filter(Boolean);

  const unique: string[] = [];
  const seen = new Set<string>();

  for (const line of lines) {
    const key = line.toLowerCase();
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    unique.push(line);

    if (unique.length >= count) {
      break;
    }
  }

  return unique;
}

export async function generateTopics(
  options: TopicOptions,
): Promise<TopicGenerateResult> {
  const count = clamp(options.count ?? 10, 3, 24);
  const variety = clamp(options.variety ?? 50, 0, 100);
  const seedTopic = options.seedTopic?.trim() || null;

  const systemPrompt = `You are a creative topic generator for AI image generation.
- Produce exactly ${count} distinct topic ideas as brief phrases (roughly 4–18 words each).
- Each topic must be visually concrete—settings, subjects, moods, or scenes someone could turn into an image prompt.
- Topics must differ meaningfully; avoid near-duplicates or rephrasings of the same idea.
- ${
    seedTopic
      ? `Every topic should relate to, riff on, or expand the seed theme "${seedTopic}". Vary angle, setting, mood, era, and subject while staying connected.`
      : "Cover diverse genres, moods, and settings with no single required theme."
  }
- Variety level: ${variety}/100 (higher = bolder, stranger, more unexpected combinations).
- Output ONLY the topic lines, one per line. No numbering, bullets, labels, markdown, or blank lines.`;

  const userMessage = seedTopic
    ? `Seed theme: ${seedTopic}\n\nWrite ${count} related image topics.`
    : `Write ${count} varied image topics with no seed theme.`;

  if (isLlmEnabled()) {
    try {
      const content = await chatCompletion({
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage },
        ],
        maxTokens: Math.min(1400, count * 48),
        temperature: 0.72 + variety / 140,
      });

      const topics = parseTopicLines(content, count);
      const minimum = Math.min(3, count);

      if (topics.length >= minimum) {
        return {
          topics,
          provider: "llm",
          seedTopic,
          count: topics.length,
        };
      }

      throw new Error("LLM returned too few topics.");
    } catch (error) {
      if (!allowTemplateFallback()) {
        throw error instanceof Error ? error : new Error("Topic generation failed.");
      }

      console.warn(
        "[topic-generator] LLM failed, using template fallback:",
        error instanceof Error ? error.message : error,
      );
    }
  }

  const topics = buildTemplateTopicList({
    seedTopic: seedTopic ?? undefined,
    count,
  });

  return {
    topics,
    provider: "template",
    seedTopic,
    count: topics.length,
  };
}
