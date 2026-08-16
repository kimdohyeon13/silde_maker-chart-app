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

function isUnitOnlyMeta(value?: string): boolean {
  if (!value) return false;
  const compact = value.replace(/\s+/g, "").toLowerCase();
  return /^(?:단위[:：]?)?(?:십억달러|10억달러|억달러|백만달러|억원|조원|\$?bn|\$?mn|bp|bps|%)(?:및(?:%|bp|bps))?$/.test(
    compact,
  );
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

  // 충실 모드에서는 원본 제목을 그대로 쓰므로 한 줄이 길어질 수 있다.
  // 32자에서 "…"로 자르면 "Late cycle…"처럼 결론이 끊기므로(A7), 제한을 넉넉히 둔다.
  // export 헤더는 줄바꿈을 허용하므로 길어도 2줄로 자연스럽게 표시된다.
  const headMessage = shortenForCard(headCandidate, 48);
  const subMessage = rawSubCandidate
    ? shortenForCard(rawSubCandidate, 80)
    : undefined;

  const deduped = dedupeMessages(headMessage, subMessage);
  // 단위만 적힌 subtitle은 축에서 보여준다. 헤더에 다시 찍으면 같은 단위가
  // 중복되고 차트 높이만 줄어든다.
  const metaParts = [isUnitOnlyMeta(subtitle) ? undefined : subtitle, timeRange].filter(Boolean);
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
