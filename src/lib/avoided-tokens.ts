import {
  buildAvoidedTokensInstructionFromList,
  filterAvoidedCandidatesFromList,
  promptContainsAvoidedTokensFromList,
  tokenizeForAvoidance,
} from "./avoidance-options";

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

export function exportAvoidedTokenList(): string[] {
  return [...loadAvoidedTokens()].slice(-80);
}

export function avoidedTokensRequestBody(): {
  avoidedTokens?: string[];
  avoidedTokensInstruction?: string;
} {
  const avoidedTokens = exportAvoidedTokenList();
  if (avoidedTokens.length === 0) {
    return {};
  }
  return {
    avoidedTokens,
    avoidedTokensInstruction: buildAvoidedTokensInstructionFromList(avoidedTokens),
  };
}

export function promptContainsAvoidedTokens(text: string, avoided = loadAvoidedTokens()): boolean {
  return promptContainsAvoidedTokensFromList(text, [...avoided]);
}

export function filterAvoidedCandidates(candidates: string[]): string[] {
  return filterAvoidedCandidatesFromList(candidates, [...loadAvoidedTokens()]);
}

export function buildAvoidedTokensInstruction(): string | undefined {
  return buildAvoidedTokensInstructionFromList([...loadAvoidedTokens()]);
}
