export const AVOIDED_TOKENS_KEY = "comfy-prompt-avoided-tokens-v1";

export function loadAvoidedTokens(): Set<string> {
  if (typeof window === "undefined") {
    return new Set();
  }
  try {
    const raw = window.localStorage.getItem(AVOIDED_TOKENS_KEY);
    if (!raw) {
      return new Set();
    }
    return new Set(JSON.parse(raw) as string[]);
  } catch {
    return new Set();
  }
}

export function recordAvoidedTokensFromPrompt(prompt: string): void {
  if (typeof window === "undefined" || !prompt.trim()) {
    return;
  }
  const tokens = tokenizeForAvoidance(prompt).slice(0, 12);
  const existing = loadAvoidedTokens();
  for (const token of tokens) {
    existing.add(token);
  }
  window.localStorage.setItem(
    AVOIDED_TOKENS_KEY,
    JSON.stringify([...existing].slice(-80)),
  );
}

function tokenizeForAvoidance(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 3);
}

export function promptContainsAvoidedTokens(text: string, avoided = loadAvoidedTokens()): boolean {
  if (avoided.size === 0 || !text.trim()) {
    return false;
  }
  const tokens = tokenizeForAvoidance(text);
  return tokens.some((token) => avoided.has(token));
}

export function filterAvoidedCandidates(candidates: string[]): string[] {
  const avoided = loadAvoidedTokens();
  if (avoided.size === 0) {
    return candidates;
  }
  const filtered = candidates.filter((entry) => !promptContainsAvoidedTokens(entry, avoided));
  return filtered.length > 0 ? filtered : candidates;
}

export function buildAvoidedTokensInstruction(): string | undefined {
  const avoided = [...loadAvoidedTokens()].slice(-20);
  if (avoided.length === 0) {
    return undefined;
  }
  return `Avoid these overused or low-rated motifs: ${avoided.join(", ")}.`;
}
