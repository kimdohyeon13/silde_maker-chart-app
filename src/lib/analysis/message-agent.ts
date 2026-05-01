import type { VisualAnalysis } from "./schema";

export interface DisplayMessages {
  headMessage: string;
  subMessage?: string;
  metaMessage?: string;
}

function normalizeText(value?: string | null): string | undefined {
  if (!value) return undefined;

  const normalized = value
    .replace(/\s+/g, " ")
    .replace(/^[•·\-–—\s]+/, "")
    .trim();

  return normalized || undefined;
}

function stripTrailingPunctuation(value: string): string {
  return value.replace(/[.,;:·\s]+$/g, "").trim();
}

function pickFirstSentence(value?: string | null): string | undefined {
  const normalized = normalizeText(value);
  if (!normalized) return undefined;

  const matched = normalized.match(/^(.+?(?:[.!?]|다\.|요\.))(?:\s|$)/);
  return stripTrailingPunctuation(matched ? matched[1] : normalized);
}

function shortenForCard(value: string, maxLength: number): string {
  const normalized = stripTrailingPunctuation(value);
  if (normalized.length <= maxLength) return normalized;

  const clauseSeparators = [",", "·", ":", " - ", " — ", " / ", " ("];
  for (const separator of clauseSeparators) {
    const index = normalized.indexOf(separator);
    if (index > 8) {
      const candidate = stripTrailingPunctuation(normalized.slice(0, index));
      if (candidate.length <= maxLength) return candidate;
    }
  }

  return `${normalized.slice(0, maxLength - 1).trimEnd()}…`;
}

function dedupeMessages(
  primary?: string,
  secondary?: string,
): { primary?: string; secondary?: string } {
  if (!primary || !secondary) return { primary, secondary };

  const normalizedPrimary = primary.replace(/\s+/g, "").toLowerCase();
  const normalizedSecondary = secondary.replace(/\s+/g, "").toLowerCase();

  if (
    normalizedPrimary === normalizedSecondary ||
    normalizedPrimary.includes(normalizedSecondary) ||
    normalizedSecondary.includes(normalizedPrimary)
  ) {
    return { primary, secondary: undefined };
  }

  return { primary, secondary };
}

export function getDisplayMessages(analysis: VisualAnalysis): DisplayMessages {
  const title = normalizeText(analysis.structure.title);
  const subtitle = normalizeText(analysis.structure.subtitle);
  const timeRange =
    "timeRange" in analysis.structure
      ? normalizeText(analysis.structure.timeRange)
      : undefined;

  const headCandidate =
    normalizeText(analysis.narrative.headMessage) ??
    title ??
    normalizeText(analysis.narrative.headline) ??
    "핵심 메시지를 정리하세요";

  const rawSubCandidate =
    normalizeText(analysis.narrative.subMessage) ??
    pickFirstSentence(analysis.narrative.summary) ??
    subtitle ??
    normalizeText(analysis.narrative.keyTakeaways[0]);

  const headMessage = shortenForCard(headCandidate, 32);
  const subMessage = rawSubCandidate
    ? shortenForCard(rawSubCandidate, 68)
    : undefined;

  const deduped = dedupeMessages(headMessage, subMessage);
  const metaParts = [subtitle, timeRange].filter(Boolean);
  const metaCandidate = metaParts.length > 0 ? metaParts.join(" · ") : undefined;
  const metaMessage =
    metaCandidate && deduped.secondary
      ? dedupeMessages(deduped.secondary, metaCandidate).secondary
      : metaCandidate;

  return {
    headMessage: deduped.primary || headMessage,
    subMessage: deduped.secondary,
    metaMessage,
  };
}
