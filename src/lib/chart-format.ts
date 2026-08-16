/**
 * =====================================================
 * chart-format.ts — 모든 차트가 공유하는 축/단위/소수 포매터
 * =====================================================
 *
 * 왜 이 파일이 필요한가? (가장 중요)
 * → 그동안 TossLineChart / TossComboChart / TossBarChart 가
 *   "거의 똑같은" X축 포매터·단위 화이트리스트·소수 자릿수 함수를 각자 복붙해서 갖고 있었다.
 * → 그래서 한 차트에서 버그(예: 연도축 소수 leak "26F.00")를 고쳐도
 *   다른 차트에는 반영이 안 돼, 결과물마다 품질이 들쭉날쭉했다.
 * → 이 파일 하나에 "축 라벨 / 단위 / 소수" 로직을 모아 모든 차트가 import 하게 한다.
 *   (사용자 원칙: 로직·설정은 한 곳에서 관리해 일괄 수정 가능하게)
 *
 * 여기 모인 함수들:
 * - formatAxisTickLabel  : X축 눈금 표시 텍스트(소수 leak 통합 제거)
 * - normalizeXKey        : 데이터 x-key ↔ tickValue 매칭용 정규화 키
 * - matchTickToDataKey   : tick(정제형)에 대응하는 실제 데이터 x-key 찾기
 * - getTickUnit          : 눈금 접미사로 붙여도 되는 짧은 단위만 통과(P0-4)
 * - getInlineLabelUnit   : 선 끝 직접라벨에 붙여도 되는 단위(= getTickUnit과 동일 정책, A3)
 * - formatValueWithUnit  : 값 + 단위 표시(통화 접두 / % 접미 / 분모단위 접미)
 * - getAxisFractionDigits: 눈금 간격(step) 기반 소수 자릿수(P0-4)
 */

/**
 * 지수/기준 단위 정규식 (P0-4)
 * → '2023=100', '지수', 'index', '기준' 등은 눈금 접미사로 쓰면 라벨이 깨진다.
 *   (예: 300 + "2023=100" → "3002023=100")
 */
const INDEX_BASELINE_UNIT_RE = /=100$|기준|지수|index/i;

/**
 * 눈금 접미사로 허용하는 짧은 척도단위 화이트리스트 (P0-4)
 * → %, $, 통화기호, p(포인트), x(배수), 배, pt, bp 등 짧은 단위만 눈금/끝라벨에 붙인다.
 *   긴 서술형 단위('십억달러' 등)나 기준표현('2020=100')은 축 라벨에만 1회 표기.
 */
const TICK_UNIT_WHITELIST_RE = /^(%|\$|US\$|₩|[€¥£]|p|x|배|pt|bp|bps)$/;

const BILLION_DOLLAR_RE = /^(?:\$?bn|십억\s*달러|10억\s*달러)$/i;

function normalizeHumanAxisText(value = ""): string {
  return value.trim().replace(/십억\s*달러/gi, "10억 달러");
}

/** 축 제목과 단위를 한 번만, 사람이 바로 읽을 수 있는 말로 합친다. */
export function formatAxisLabel(label = "", unit = ""): string {
  const normalizedLabel = normalizeHumanAxisText(label);
  const normalizedUnit = BILLION_DOLLAR_RE.test(unit)
    ? "10억 달러"
    : normalizeHumanAxisText(unit);

  if (!normalizedLabel || normalizedLabel === "값") return normalizedUnit;
  if (!normalizedUnit) return normalizedLabel;
  if (
    normalizedLabel === normalizedUnit ||
    normalizedLabel.includes(normalizedUnit) ||
    (BILLION_DOLLAR_RE.test(label) && BILLION_DOLLAR_RE.test(unit))
  ) {
    return normalizedLabel;
  }

  return `${normalizedLabel} (${normalizedUnit})`;
}

/** 긴 범주 라벨을 단어와 괄호 경계에서 최대 3줄로 나눈다. */
export function wrapCategoryLabel(label: string, maxChars = 14, maxLines = 3): string[] {
  const rawTokens = label
    .replace(/\s*\(/g, " (")
    .replace(/,\s*/g, ", ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  const tokens = rawTokens.flatMap((token) => {
    if (token.length <= maxChars) return [token];

    const pieces = token.match(/[^/\-]+[/\-]?|[/\-]/g) ?? [token];
    const chunks: string[] = [];
    for (const piece of pieces) {
      const current = chunks[chunks.length - 1];
      if (current && current.length + piece.length <= maxChars) {
        chunks[chunks.length - 1] = current + piece;
        continue;
      }
      if (piece.length <= maxChars) {
        chunks.push(piece);
        continue;
      }
      for (let index = 0; index < piece.length; index += maxChars) {
        chunks.push(piece.slice(index, index + maxChars));
      }
    }
    return chunks;
  });
  const lines: string[] = [];

  for (const token of tokens) {
    const current = lines[lines.length - 1];
    if (!current || current.length + 1 + token.length > maxChars) {
      lines.push(token);
    } else {
      lines[lines.length - 1] = `${current} ${token}`;
    }
  }

  if (lines.length <= maxLines) return lines;

  // 마지막 줄 하나에 남은 내용을 몰아넣으면 다시 겹친다. 원문은 보존하면서
  // 최대 줄 수 안에서 길이가 비슷하도록 다시 나눈다.
  const compact = lines.join(" ");
  const targetLength = Math.ceil(compact.length / maxLines);
  const balanced: string[] = [];
  for (const token of tokens) {
    const current = balanced[balanced.length - 1];
    if (!current || (balanced.length < maxLines && current.length >= targetLength)) {
      balanced.push(token);
    } else {
      balanced[balanced.length - 1] = `${current} ${token}`;
    }
  }
  return balanced;
}

/**
 * X축 눈금에 표시할 텍스트를 만든다 — "소수 leak" 통합 제거판.
 *
 * 기존 문제(차트마다 제각각이라 leak이 남았음):
 * → TossLineChart/TossComboChart는 4자리 연도 소수("2024.00")만 정수화했다.
 * → 그래서 "26F.00"(접미사), "24.00"(2자리), "96.00"(2자리)은 그대로 화면에 새어나왔다.
 *   (page-09 "24.00 / 26F.00", page-06-table-02 "96.00", page-13-table-03 "23.00" 등)
 *
 * 처리 규칙(원본 충실: 24/25/26 스타일을 지킨다):
 * 1. "YYYY-MM"            → "YYYY.MM"   (월별)
 * 2. "24.06.2"           → "24.06 중"  (반기/중순 표기)
 * 3. "FY1Q26E"           → "1Q26E"     (회계분기)
 * 4. "26F.00","26F.04"   → "26F"       (접미사 붙은 연도 + 후행 소수)   ← 신규(leak 차단)
 * 5. "2024.00","24.00","96.00","-15.0" → "2024","24","96","-15" (정수 + 0만 있는 후행 소수)
 *    실제 월·소수 값인 "2023.07", "4.48"은 그대로 보존한다.
 * 그 외에는 원본 문자열을 그대로 둔다.
 */
export function formatAxisTickLabel(value: string | number): string {
  const raw = String(value).trim();

  // 0) 일별 "YYYY-MM-DD" → "M/D"
  const fullDate = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (fullDate) return `${Number(fullDate[2])}/${Number(fullDate[3])}`;

  // 1) 월별 "YYYY-MM" → "YYYY.MM"
  const month = raw.match(/^(\d{4})-(\d{2})$/);
  if (month) return `${month[1]}.${month[2]}`;

  // 2) 반기/중순 "24.06.2" → "24.06 중"
  const halfMonth = raw.match(/^(\d{2})\.(\d{2})\.2$/);
  if (halfMonth) return `${halfMonth[1]}.${halfMonth[2]} 중`;

  // 3) 회계분기 "FY1Q26E" → "1Q26E"
  const fiscalQuarter = raw.match(/^FY(\dQ\d{2}E?)$/);
  if (fiscalQuarter) return fiscalQuarter[1];

  // 4) 접미사(F/E 등) 연도에 후행 소수: "26F.00" → "26F", "26F.04" → "26F"
  const suffixYear = raw.match(/^(\d{1,4}[A-Za-z]+)\.\d+$/);
  if (suffixYear) return suffixYear[1];

  // 5) 정수에 0만 붙은 후행 소수: "2024.00"/"24.00"/"-15.0" → 정수부만
  const decimalNum = raw.match(/^(-?\d+)\.0+$/);
  if (decimalNum) return decimalNum[1];

  return raw;
}

/**
 * 후행 소수/공백을 제거한 "정규화 키"를 만든다 (P0-5)
 * → 데이터 x-key("23.00","26F.04")와 tickValue("23","26F")를 같은 기준으로 비교하기 위함.
 */
export function normalizeXKey(value: string | number): string {
  const raw = String(value).trim();
  const suffixYear = raw.match(/^(\d{1,4}[A-Za-z]+)\.\d+$/);
  if (suffixYear) return suffixYear[1];

  const integerWithZeroDecimals = raw.match(/^(-?\d+)\.0+$/);
  return integerWithZeroDecimals ? integerWithZeroDecimals[1] : raw;
}

/**
 * tick(정제형)에 대응하는 "실제 데이터 x-key"를 찾는다 (P0-5)
 * 매칭 우선순위: 1) 정확일치 2) 정규화 일치 3) prefix 매칭
 * → Recharts ticks=에는 데이터에 실제 존재하는 키를 넘겨야 라벨이 그려진다.
 */
export function matchTickToDataKey(tick: string, dataKeys: string[]): string | undefined {
  if (dataKeys.includes(tick)) return tick;
  const normTick = normalizeXKey(tick);
  const normHit = dataKeys.find((k) => normalizeXKey(k) === normTick);
  if (normHit) return normHit;
  if (normTick.length > 0) {
    const prefixHit = dataKeys.find((k) => k.startsWith(tick) || k.startsWith(normTick));
    if (prefixHit) return prefixHit;
  }
  return undefined;
}

/**
 * 눈금 접미사로 붙일 단위를 결정한다 (P0-4)
 * 규칙:
 * 1. 단위가 비었으면 → 붙이지 않음
 * 2. '=100'/기준/지수/index류면 → 붙이지 않음(축 라벨에만 1회)
 * 3. 그 단위가 축 라벨 텍스트에 이미 있으면 → 붙이지 않음(중복 방지)
 * 4. 그 외에는 짧은 척도단위(%,$,p,x,통화기호 등)만 화이트리스트로 허용
 * 5. '/bbl','/oz'처럼 짧은 분모단위(슬래시 시작)는 허용
 */
export function getTickUnit(unit = "", axisLabel = ""): string {
  if (!unit) return "";
  if (INDEX_BASELINE_UNIT_RE.test(unit)) return "";
  if (axisLabel && axisLabel.includes(unit)) return "";
  if (TICK_UNIT_WHITELIST_RE.test(unit)) return unit;
  if (unit.startsWith("/") && unit.length <= 6) return unit;
  return "";
}

/**
 * 선 끝 "직접 라벨"에 붙여도 되는 단위 (A3 단위 병합 깨짐 방지)
 * → 직접라벨도 눈금과 같은 정책을 쓴다: 기준표현('2020=100')은 빼고 짧은 단위만.
 *   (예전엔 라벨에 yAxis.unit를 그대로 붙여 '상대강도 1062020=100'처럼 병합됐다.)
 */
export function getInlineLabelUnit(unit = "", axisLabel = ""): string {
  return getTickUnit(unit, axisLabel);
}

/**
 * 값 + 단위를 사람이 읽기 좋은 문자열로 만든다.
 * - 통화($, US$, ₩, €¥£)는 숫자 앞에 붙인다.
 * - "$/bbl"처럼 통화+분모 단위는 "$16/bbl"로.
 * - %는 숫자 뒤에, "/bbl" 같은 분모단위도 숫자 뒤에.
 */
export function formatValueWithUnit(value: number, unit = "", fractionDigits = 0): string {
  const rounded = Number(value);
  // 소수 자릿수가 0보다 크면 정수라도 자릿수를 유지(예: 0.0/0.2 눈금에서 0이 절단되지 않게)
  const effectiveDigits =
    Number.isInteger(rounded) && fractionDigits === 0 ? 0 : fractionDigits;
  const num = Number(value).toLocaleString("ko-KR", {
    minimumFractionDigits: effectiveDigits,
    maximumFractionDigits: effectiveDigits,
  });

  if (!unit) return num;
  if (unit === "$" || unit === "US$" || unit === "₩") return `${unit}${num}`;
  if (unit.startsWith("$")) return `$${num}${unit.slice(1)}`; // "$/bbl" → "$16/bbl"
  if (/^[€¥£]/.test(unit)) return `${unit}${num}`;
  if (unit === "%") return `${num}%`;
  if (unit.startsWith("/")) return `${num}${unit}`;
  return `${num}${unit}`;
}

/**
 * 눈금 간격(step) 기반 소수 자릿수 계산 (P0-4)
 * → range≥1이면 무조건 0자리로 두던 옛 방식은 상관계수 눈금 -0.4를 '-0'으로 절단했다.
 * → 실제 눈금값들의 "인접 간격" 최솟값을 보고 소수 자릿수를 정한다.
 *   간격 < 0.1 → 2자리, 간격 < 1 → 1자리, 그 외 → 0자리.
 *   눈금이 부족하면 (max-min) 범위로 폴백.
 */
export function getAxisFractionDigits(
  min?: number,
  max?: number,
  ticks?: Array<string | number>,
): number {
  const finite = (ticks ?? [])
    .map((t) => Number(String(t).replace(/[^\d.-]/g, "")))
    .filter((t) => Number.isFinite(t));
  if (finite.length >= 2) {
    const sorted = [...finite].sort((a, b) => a - b);
    let minGap = Infinity;
    for (let i = 1; i < sorted.length; i++) {
      const gap = Math.abs(sorted[i] - sorted[i - 1]);
      if (gap > 0 && gap < minGap) minGap = gap;
    }
    if (Number.isFinite(minGap)) {
      if (minGap < 0.1) return 2;
      if (minGap < 1) return 1;
      return 0;
    }
  }
  const range = min != null && max != null ? Math.abs(max - min) : Infinity;
  if (range > 0 && range < 0.1) return 2;
  if (range > 0 && range < 1) return 1;
  return 0;
}

/**
 * min~max 범위에서 "보기 좋은 균등 눈금"을 생성한다 (D2)
 *
 * 왜 필요한가?
 * → Y축에 tickValues가 없으면 Recharts가 임의 눈금(6개)을 만들고,
 *   그걸 정수로 반올림하면서 "1,1,2,2"(중복)나 "10/70/120"(비균등) 같은 깨진 눈금이 나왔다.
 * → 그래서 도메인(min~max)에서 1·2·5·10 계열의 "nice number" 간격으로 균등 눈금을 직접 만든다.
 *
 * 반환: 오름차순 균등 눈금 배열(중복 없음). 입력이 부적합하면 빈 배열(호출부에서 기존 동작 유지).
 */
export function generateNiceTicks(
  min?: number,
  max?: number,
  targetCount = 6,
): number[] {
  if (
    min == null ||
    max == null ||
    !Number.isFinite(min) ||
    !Number.isFinite(max) ||
    min === max
  ) {
    return [];
  }
  const lo = Math.min(min, max);
  const hi = Math.max(min, max);
  const range = hi - lo;
  const rawStep = range / Math.max(targetCount - 1, 1);
  // rawStep을 1·2·5·10 계열의 "nice" 간격으로 올림
  const magnitude = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const normalized = rawStep / magnitude;
  let niceUnit: number;
  if (normalized < 1.5) niceUnit = 1;
  else if (normalized < 3) niceUnit = 2;
  else if (normalized < 7) niceUnit = 5;
  else niceUnit = 10;
  const step = niceUnit * magnitude;
  // 도메인을 덮는 균등 눈금 (양 끝을 step 경계로 맞춤)
  const niceMin = Math.floor(lo / step) * step;
  const niceMax = Math.ceil(hi / step) * step;
  const ticks: number[] = [];
  // 부동소수 오차로 인한 중복/누락을 막기 위해 step 단위로 반올림하며 채운다
  const decimals = step < 1 ? Math.ceil(-Math.log10(step)) + 1 : 0;
  for (let v = niceMin; v <= niceMax + step * 0.5; v += step) {
    const rounded = Number(v.toFixed(decimals));
    if (ticks.length === 0 || ticks[ticks.length - 1] !== rounded) {
      ticks.push(rounded);
    }
  }
  return ticks;
}

/**
 * 출처(source) 문자열에서 최종 장표에 필요 없는 내부 메타데이터를 제거한다.
 *
 * 최종 장표에는 원문 근거만 보여준다. `source-visible`, `directional`,
 * 저장소 재사용, 데이터 상태 같은 내부 판정은 JSON과 QA 문서에만 남긴다.
 * 데이터 제공처와 원문 날짜는 보존한다.
 *
 * 예)
 *   "자료: LSEG, 신한투자증권" → 그대로 보존
 *   "Bloomberg, 신한투자증권"  → 그대로 보존
 *   "자료: TSMC IR · source-visible" → "자료: TSMC IR"
 *   "자료: TSMC IR · 저장소 기존 검증 데이터 재사용" → "자료: TSMC IR"
 */
export function cleanSourceText(raw?: string): string {
  if (!raw) return "";
  const s = raw
    // 최종 이미지에 내부 fidelity 상태와 제작 이력을 노출하지 않는다.
    .replace(
      /\s*(?:[·•|]\s*)?(?:데이터\s+상태|data\s+(?:state|status))\s*[:：]?\s*(?:source-visible|directional|redrawn)(?:\s*에서\s*(?:유도|derived))?/gi,
      "",
    )
    .replace(
      /\s*(?:[·•|]\s*)?\(?(?:source-visible|directional|redrawn)(?:\s+(?:data|데이터)\s+(?:status|상태))?(?:\s*에서\s*(?:유도|derived))?\)?/gi,
      "",
    )
    .replace(
      /\s*(?:[·•|]\s*)?(?:저장소\s+)?기존\s+검증\s+데이터\s+재사용/gi,
      "",
    )
    // 남은 찌꺼기 정리: 앞뒤 구분자·중복 공백
    .replace(/^(?:\s*[·•|]\s*)+/, "")
    .replace(/[\s,/·]+$/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
  // "자료:" / "출처:" 라벨만 덩그러니 남으면 빈 출처로 처리(상위에서 숨김)
  if (/^(자료|출처|source)\s*[:：]?\s*$/i.test(s)) return "";
  return s;
}
