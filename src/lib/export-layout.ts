export type ExportHeaderVariant =
  | "stacked"
  | "top-rule"
  | "left-rail"
  | "centered"
  | "split-metric"
  | "signal-editorial";

export type ExportFrameStyle = "none" | "hairline" | "boxed";

type StyleValue = string | number | undefined;
type StyleRecord = Record<string, StyleValue>;

export interface ResolvedHeaderLayout {
  container: StyleRecord;
  main: StyleRecord;
  copy: StyleRecord;
  showMetric: boolean;
}

const CENTERED_TITLE_WIDTH = 828;
const MIN_CENTERED_TITLE_FONT_SIZE = 32;
const MIN_BALANCED_LAST_LINE_WIDTH = 3;
const MIN_FILLED_CHART_HEIGHT = 240;

function estimateTitleWidth(title: string, fontSize: number): number {
  return Array.from(title).reduce((width, character) => {
    if (/\s/u.test(character)) {
      return width + fontSize * 0.3;
    }

    if (/[\u0000-\u024f]/u.test(character)) {
      return width + fontSize * 0.56;
    }

    if (/[\p{P}\p{S}]/u.test(character)) {
      return width + fontSize * 0.45;
    }

    return width + fontSize;
  }, 0);
}

/**
 * 중앙 제목의 마지막 줄에 한두 글자만 남을 때만 기본 글자 크기를 줄인다.
 * JSON에서 직접 지정한 크기는 제작 의도로 보고 그대로 둔다.
 */
export function resolveCenteredTitleFontSize(
  title: string,
  defaultFontSize: number,
  explicitFontSize: number | undefined,
  variant: ExportHeaderVariant | undefined,
): number {
  if (explicitFontSize !== undefined || variant !== "centered") {
    return explicitFontSize ?? defaultFontSize;
  }

  for (let fontSize = defaultFontSize; fontSize >= MIN_CENTERED_TITLE_FONT_SIZE; fontSize -= 2) {
    const estimatedWidth = estimateTitleWidth(title, fontSize);
    const lineCount = Math.ceil(estimatedWidth / CENTERED_TITLE_WIDTH);
    const lastLineWidth = estimatedWidth - CENTERED_TITLE_WIDTH * (lineCount - 1);

    if (
      lineCount === 1 ||
      lastLineWidth >= fontSize * MIN_BALANCED_LAST_LINE_WIDTH ||
      lastLineWidth === 0
    ) {
      return fontSize;
    }
  }

  return MIN_CENTERED_TITLE_FONT_SIZE;
}

export function resolveCanvasHeight(value?: number): number | undefined {
  return Number.isFinite(value) && (value ?? 0) > 0 ? value : undefined;
}

/**
 * 고정 캔버스에서 헤더와 출처를 뺀 실제 공간만큼 차트를 채운다.
 * 브라우저가 아직 높이를 재지 못했거나 공간이 지나치게 작으면 기존 높이를 유지한다.
 */
export function resolveFilledChartHeight(
  measuredContentHeight: number,
  paddingTop: number,
  paddingBottom: number,
  fallbackHeight: number,
): number {
  const usableHeight = Math.floor(measuredContentHeight - paddingTop - paddingBottom);

  if (!Number.isFinite(usableHeight) || usableHeight < MIN_FILLED_CHART_HEIGHT) {
    return fallbackHeight;
  }

  return usableHeight;
}

export function resolveExportFrame(
  frameStyle: ExportFrameStyle | undefined,
  borderWidth: number,
  borderColor: string,
  defaultShadow: string,
) {
  if (frameStyle === "none") {
    return { border: "0", boxShadow: "none" };
  }

  if (frameStyle === "hairline") {
    return { border: `1px solid ${borderColor}`, boxShadow: "none" };
  }

  if (frameStyle === "boxed") {
    return { border: `${borderWidth}px solid ${borderColor}`, boxShadow: "none" };
  }

  return {
    border: `${borderWidth}px solid ${borderColor}`,
    boxShadow: defaultShadow,
  };
}

export function resolveHeaderLayout(
  variant: ExportHeaderVariant = "stacked",
  accentColor = "#101828",
): ResolvedHeaderLayout {
  const base: ResolvedHeaderLayout = {
    container: {},
    main: { display: "block" },
    copy: { minWidth: 0, textAlign: "left" },
    showMetric: false,
  };

  if (variant === "top-rule") {
    return {
      ...base,
      container: { borderTop: `6px solid ${accentColor}`, paddingTop: 14 },
    };
  }

  if (variant === "left-rail") {
    return {
      ...base,
      container: { borderLeft: `6px solid ${accentColor}`, paddingLeft: 20 },
    };
  }

  if (variant === "centered") {
    return {
      ...base,
      container: {
        borderTop: `1px solid ${accentColor}`,
        borderBottom: `1px solid ${accentColor}`,
        paddingTop: 14,
        paddingBottom: 14,
      },
      copy: { minWidth: 0, textAlign: "center" },
    };
  }

  if (variant === "split-metric") {
    return {
      ...base,
      main: {
        display: "grid",
        gridTemplateColumns: "minmax(0, 1fr) auto",
        alignItems: "end",
        gap: 28,
      },
      showMetric: true,
    };
  }

  if (variant === "signal-editorial") {
    return {
      ...base,
      container: {
        borderTop: `4px solid ${accentColor}`,
        paddingTop: 14,
      },
      main: {
        display: "grid",
        gridTemplateColumns: "minmax(0, 1fr) auto",
        alignItems: "end",
        gap: 32,
      },
      showMetric: true,
    };
  }

  return base;
}
