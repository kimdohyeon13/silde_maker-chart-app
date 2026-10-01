import type {
  ExportOptions,
  StylePresetId,
  TableVisualOptions,
  VisualAnalysis,
} from "./analysis/schema.ts";
import {
  getRechartsStyle,
  getTheme,
  type ThemeMode,
  type TossTheme,
} from "./theme/toss-theme.ts";
import {
  DEFAULT_HEAD_MESSAGE_WEIGHT,
  DEFAULT_SUB_MESSAGE_WEIGHT,
  PAPERLOGY_FONT_STACK,
} from "./slide-typography.ts";

type PresetMode = "inherit" | ThemeMode;
type ThemeColors = TossTheme["colors"];

export interface RemakeStylePreset {
  id: StylePresetId;
  name: string;
  shortName: string;
  description: string;
  /** 기존 JSON 호환용으로만 남기고 새 선택 UI에서는 숨길 때 사용 */
  deprecated?: boolean;
  mode: PresetMode;
  colors: {
    light: Partial<ThemeColors>;
    dark: Partial<ThemeColors>;
  };
  typography: {
    titleWeight: number;
    subtitleWeight: number;
    titleLetterSpacing: number;
    fontFamily?: string;
  };
  card: {
    borderRadius: number;
    borderWidth: number;
    shadow: string;
  };
  export: {
    borderRadius: string;
    headerPadding: string;
    contentPadding: string;
    sourcePadding: string;
    titleFontSize: number;
    subtitleFontSize: number;
    sourceFontSize: number;
  };
  table: {
    rowHeightDelta: number;
    zebraStripe?: boolean;
    highlightMode?: "background" | "text";
    headerTransform?: "none" | "uppercase";
  };
  /** 콘텐츠와 무관한 안전한 기본값. 분석 JSON의 개별 옵션이 항상 우선한다. */
  exportDefaults?: Partial<ExportOptions>;
  tableDefaults?: Partial<TableVisualOptions>;
}

export const DEFAULT_STYLE_PRESET: StylePresetId = "toss-clean";

export const STYLE_PRESETS: Record<StylePresetId, RemakeStylePreset> = {
  "toss-clean": {
    id: "toss-clean",
    name: "Toss Clean",
    shortName: "Toss",
    description: "깨끗한 흰 배경과 굵은 한글 타이포로 발표·Notion 삽입에 맞춘 기본형",
    mode: "inherit",
    colors: {
      light: {
        background: "#FFFFFF",
        surface: "#FFFFFF",
        border: "#D7DEE5",
        borderSubtle: "#E8ECF0",
        textPrimary: "#1F2328",
        textSecondary: "#656D76",
        textTertiary: "#8C959F",
        accent: "#087A68",
        gridLine: "rgba(208, 215, 222, 0.72)",
        axisLine: "#9AA6B2",
        axisLabel: "#6B7280",
      },
      dark: {},
    },
    typography: {
      titleWeight: DEFAULT_HEAD_MESSAGE_WEIGHT,
      subtitleWeight: DEFAULT_SUB_MESSAGE_WEIGHT,
      titleLetterSpacing: 0,
      fontFamily: PAPERLOGY_FONT_STACK,
    },
    card: {
      borderRadius: 9,
      borderWidth: 1,
      shadow: "none",
    },
    export: {
      borderRadius: "9px 9px 0 0",
      headerPadding: "12px 24px 2px",
      contentPadding: "0 10px",
      sourcePadding: "0 24px 8px",
      titleFontSize: 38,
      subtitleFontSize: 18,
      sourceFontSize: 11,
    },
    table: {
      rowHeightDelta: 0,
    },
    exportDefaults: {
      backgroundColor: "#FFFFFF",
      frameStyle: "hairline",
      headerVariant: "left-rail",
      contentBorder: false,
      squareEdges: true,
      showAreaFill: false,
      gridMode: "solid",
      lineStrokeWidth: 2.6,
      chartLabelScale: 0.85,
      chartLabelFontWeight: 600,
      showLatestGuide: false,
      accentColor: "#087A68",
      borderColor: "#DCE3EB",
    },
    tableDefaults: {
      zebraStripe: false,
      highlightMode: "text",
      headerTone: "tinted",
      rowRules: "soft",
      groupHeaderTone: "accent-rule",
      columnRules: false,
      sectionRules: true,
      accentColor: "#087A68",
      rowRuleColor: "#DDE4EA",
      sectionRuleColor: "#CBD5DF",
      lineHeight: 1.2,
      cellPadding: "2px 6px",
      fitRowsToCanvas: true,
      minRowHeight: 29,
      maxRowHeight: 43,
      fontWeight: { body: 500, numeric: 550, rowHeader: 650, header: 650, groupHeader: 650 },
    },
  },
  "consulting-slide": {
    id: "consulting-slide",
    name: "Consulting Slide",
    shortName: "MBB",
    description: "결론형 제목, 넓은 여백, 차분한 흑백 대비 중심의 컨설팅 장표형",
    mode: "light",
    colors: {
      light: {
        background: "#FFFFFF",
        surface: "#FFFFFF",
        elevated: "#FFFFFF",
        border: "#111827",
        borderSubtle: "#D1D5DB",
        textPrimary: "#101828",
        textSecondary: "#475467",
        textTertiary: "#667085",
        accent: "#111827",
        accentSubtle: "rgba(17, 24, 39, 0.08)",
        positive: "#B42318",
        positiveSubtle: "rgba(180, 35, 24, 0.09)",
        negative: "#175CD3",
        negativeSubtle: "rgba(23, 92, 211, 0.08)",
        warning: "#B54708",
        warningSubtle: "rgba(181, 71, 8, 0.08)",
        gridLine: "rgba(16, 24, 40, 0.18)",
        axisLine: "#98A2B3",
        axisLabel: "#667085",
        tooltipBg: "#FFFFFF",
        tooltipBorder: "#98A2B3",
        series: ["#111827", "#B42318", "#175CD3", "#027A48", "#93370D", "#5925DC"],
      },
      dark: {},
    },
    typography: {
      titleWeight: DEFAULT_HEAD_MESSAGE_WEIGHT,
      subtitleWeight: DEFAULT_SUB_MESSAGE_WEIGHT,
      titleLetterSpacing: 0,
      fontFamily: PAPERLOGY_FONT_STACK,
    },
    card: {
      borderRadius: 4,
      borderWidth: 1.4,
      shadow: "0 18px 45px rgba(16, 24, 40, 0.08)",
    },
    export: {
      borderRadius: "4px 4px 0 0",
      headerPadding: "44px 52px 0",
      contentPadding: "22px 24px 22px",
      sourcePadding: "0 52px 24px",
      titleFontSize: 60,
      subtitleFontSize: 34,
      sourceFontSize: 23,
    },
    table: {
      rowHeightDelta: 6,
      zebraStripe: false,
      highlightMode: "text",
      headerTransform: "none",
    },
  },
  "market-terminal": {
    id: "market-terminal",
    name: "Market Terminal",
    shortName: "Terminal",
    description: "어두운 터미널 톤, 높은 정보 밀도, 시장 대시보드 느낌의 고밀도 스타일",
    mode: "dark",
    colors: {
      light: {},
      dark: {
        background: "#07110F",
        surface: "#0B1514",
        surfaceHover: "#10201D",
        surfaceActive: "#142B27",
        elevated: "#10201D",
        border: "#24433D",
        borderSubtle: "#17332E",
        divider: "#17332E",
        // 다크 배경에서도 제목·보조 라벨·출처가 한 번에 읽히도록
        // 기존 초록빛 회색을 부드러운 백색 민트 계열로 올린다.
        textPrimary: "#F5FFFC",
        textSecondary: "#D9F2EB",
        textTertiary: "#B6D8CF",
        accent: "#00E0A4",
        accentSubtle: "rgba(0, 224, 164, 0.13)",
        accentMuted: "#35C99B",
        positive: "#FF6A5F",
        positiveSubtle: "rgba(255, 106, 95, 0.13)",
        negative: "#4AA8FF",
        negativeSubtle: "rgba(74, 168, 255, 0.13)",
        warning: "#FFD166",
        warningSubtle: "rgba(255, 209, 102, 0.13)",
        gridLine: "rgba(80, 148, 132, 0.34)",
        axisLine: "#24433D",
        axisLabel: "#C2E5DC",
        tooltipBg: "#10201D",
        tooltipBorder: "#24433D",
        series: ["#00E0A4", "#FF6A5F", "#4AA8FF", "#FFD166", "#A78BFA", "#F472B6"],
      },
    },
    typography: {
      titleWeight: DEFAULT_HEAD_MESSAGE_WEIGHT,
      subtitleWeight: DEFAULT_SUB_MESSAGE_WEIGHT,
      titleLetterSpacing: 0,
      fontFamily: PAPERLOGY_FONT_STACK,
    },
    card: {
      borderRadius: 2,
      borderWidth: 1,
      shadow: "0 22px 55px rgba(0, 0, 0, 0.32)",
    },
    export: {
      borderRadius: "2px 2px 0 0",
      headerPadding: "12px 24px 2px",
      contentPadding: "0 10px",
      sourcePadding: "0 24px 8px",
      titleFontSize: 48,
      subtitleFontSize: 28,
      sourceFontSize: 21,
    },
    exportDefaults: {
      headerVariant: "left-rail", frameStyle: "hairline", squareEdges: true,
      backgroundColor: "#07110F", accentColor: "#00E0A4", borderColor: "#24433D",
      showAreaFill: false, gridMode: "solid", lineStrokeWidth: 2.6,
      chartLabelScale: 0.85, chartLabelFontWeight: 600, subtitleFontWeight: 300,
    },
    tableDefaults: {
      headerTone: "tinted", groupHeaderTone: "accent-rule", zebraStripe: false,
      lineHeight: 1.2, cellPadding: "2px 6px", fitRowsToCanvas: true,
      minRowHeight: 29, maxRowHeight: 43, rowRules: "soft", columnRules: false,
      accentColor: "#0F4A3B", rowRuleColor: "#24433D", sectionRuleColor: "#24433D",
      fontWeight: { body: 500, numeric: 550, rowHeader: 650, header: 650, groupHeader: 650 },
    },
    table: {
      rowHeightDelta: -5,
      zebraStripe: true,
      highlightMode: "text",
      headerTransform: "uppercase",
    },
  },
  "editorial-card": {
    id: "editorial-card",
    name: "Editorial Card",
    shortName: "Editorial",
    description: "기사·뉴스레터·유튜브 카드에 맞춘 부드러운 설명형 스타일",
    mode: "light",
    colors: {
      light: {
        background: "#FBFCFE",
        surface: "#FFFFFF",
        elevated: "#FFFFFF",
        border: "#D8E0EA",
        borderSubtle: "#E8EEF5",
        textPrimary: "#172033",
        textSecondary: "#4F5F75",
        textTertiary: "#7A8AA0",
        accent: "#2F6FDB",
        accentSubtle: "rgba(47, 111, 219, 0.09)",
        positive: "#C2410C",
        positiveSubtle: "rgba(194, 65, 12, 0.09)",
        negative: "#1D4ED8",
        negativeSubtle: "rgba(29, 78, 216, 0.09)",
        warning: "#A16207",
        warningSubtle: "rgba(161, 98, 7, 0.09)",
        gridLine: "rgba(122, 138, 160, 0.18)",
        axisLine: "#8EA0B5",
        axisLabel: "#728196",
        tooltipBg: "#FFFFFF",
        tooltipBorder: "#D8E0EA",
        series: ["#2F6FDB", "#C2410C", "#16815E", "#A16207", "#7C3AED", "#BE185D"],
      },
      dark: {},
    },
    typography: {
      titleWeight: DEFAULT_HEAD_MESSAGE_WEIGHT,
      subtitleWeight: DEFAULT_SUB_MESSAGE_WEIGHT,
      titleLetterSpacing: 0,
      fontFamily: PAPERLOGY_FONT_STACK,
    },
    card: {
      borderRadius: 8,
      borderWidth: 1,
      shadow: "0 18px 44px rgba(47, 72, 103, 0.12)",
    },
    export: {
      borderRadius: "8px 8px 0 0",
      headerPadding: "38px 46px 0",
      contentPadding: "16px 18px 18px",
      sourcePadding: "0 46px 22px",
      titleFontSize: 54,
      subtitleFontSize: 33,
      sourceFontSize: 23,
    },
    table: {
      rowHeightDelta: 3,
      zebraStripe: true,
      highlightMode: "background",
      headerTransform: "none",
    },
  },
  "signal-editorial": {
    id: "signal-editorial",
    name: "Signal Editorial",
    shortName: "Signal",
    description: "상단 신호선, 핵심 수치, 의미 블록 구분을 결합한 기관투자자용 에디토리얼 스타일",
    deprecated: true,
    mode: "light",
    colors: {
      light: {
        background: "#FFFFFF",
        surface: "#FFFFFF",
        elevated: "#FFFFFF",
        border: "#C9D6D1",
        borderSubtle: "#E2EAE7",
        textPrimary: "#14201D",
        textSecondary: "#4D5F59",
        textTertiary: "#72827D",
        accent: "#0E6B5C",
        accentSubtle: "rgba(14, 107, 92, 0.08)",
        positive: "#D92D20",
        positiveSubtle: "rgba(217, 45, 32, 0.08)",
        negative: "#2563EB",
        negativeSubtle: "rgba(37, 99, 235, 0.08)",
        warning: "#9A6700",
        warningSubtle: "rgba(154, 103, 0, 0.08)",
        gridLine: "rgba(20, 32, 29, 0.12)",
        axisLine: "#AABAB5",
        axisLabel: "#60736D",
        tooltipBg: "#FFFFFF",
        tooltipBorder: "#C9D6D1",
        series: ["#0E6B5C", "#D92D20", "#2563EB", "#A36C16", "#6E56CF", "#B5476F"],
      },
      dark: {},
    },
    typography: {
      titleWeight: 900,
      subtitleWeight: 650,
      titleLetterSpacing: -0.02,
      fontFamily: 'var(--font-noto-sans-kr), "Noto Sans KR", "Apple SD Gothic Neo", ui-sans-serif, system-ui, sans-serif',
    },
    card: {
      borderRadius: 0,
      borderWidth: 1,
      shadow: "none",
    },
    export: {
      borderRadius: "0",
      headerPadding: "30px 40px 0",
      contentPadding: "10px 24px 14px",
      sourcePadding: "0 40px 18px",
      titleFontSize: 50,
      subtitleFontSize: 28,
      sourceFontSize: 20,
    },
    table: {
      rowHeightDelta: 1,
      zebraStripe: false,
      highlightMode: "text",
      headerTransform: "none",
    },
    exportDefaults: {
      backgroundColor: "#FFFFFF",
      frameStyle: "none",
      headerVariant: "signal-editorial",
      contentBorder: false,
      squareEdges: true,
      showAreaFill: false,
      gridMode: "solid",
      lineStrokeWidth: 4,
      showLatestGuide: true,
      latestGuideOpacity: 0.24,
      accentColor: "#0E6B5C",
      titleFontFamily: '"AppleMyungjo", "Noto Serif KR", Georgia, serif',
    },
    tableDefaults: {
      zebraStripe: false,
      highlightMode: "text",
      headerTone: "underline",
      rowRules: "soft",
      groupHeaderTone: "accent-rule",
      sectionRules: true,
      accentColor: "#0E6B5C",
      rowRuleColor: "#E2EAE7",
      sectionRuleColor: "#C9D6D1",
    },
  },
};

export function getStylePresetOptions() {
  return Object.values(STYLE_PRESETS).filter((preset) => !preset.deprecated);
}

export function getStylePreset(id?: string): RemakeStylePreset {
  if (id && id in STYLE_PRESETS) {
    return STYLE_PRESETS[id as StylePresetId];
  }

  return STYLE_PRESETS[DEFAULT_STYLE_PRESET];
}

export function getAnalysisStylePreset(analysis?: Pick<VisualAnalysis, "stylePreset">) {
  return getStylePreset(analysis?.stylePreset);
}

export function getAnalysisThemeMode(
  analysis: Pick<VisualAnalysis, "stylePreset"> | undefined,
  fallback: ThemeMode
): ThemeMode {
  const preset = getAnalysisStylePreset(analysis);
  return preset.mode === "inherit" ? fallback : preset.mode;
}

export function getPresetColors(
  preset: RemakeStylePreset,
  mode: ThemeMode
): ThemeColors {
  const base = getTheme(mode).colors;
  return {
    ...base,
    ...preset.colors[mode],
  };
}

export function getAnalysisPresetColors(
  analysis: Pick<VisualAnalysis, "stylePreset"> | undefined,
  fallback: ThemeMode
) {
  const mode = getAnalysisThemeMode(analysis, fallback);
  return getPresetColors(getAnalysisStylePreset(analysis), mode);
}

export function getPresetRechartsStyle(
  analysis: Pick<VisualAnalysis, "stylePreset" | "exportOptions"> | undefined,
  fallback: ThemeMode
) {
  const mode = getAnalysisThemeMode(analysis, fallback);
  const colors = getAnalysisPresetColors(analysis, fallback);
  const styles = getRechartsStyle(mode);
  const presetDefaults = getAnalysisStylePreset(analysis).exportDefaults;
  const requestedScale = analysis?.exportOptions?.chartLabelScale ?? presetDefaults?.chartLabelScale;
  const labelScale = Number.isFinite(requestedScale)
    ? Math.min(1.25, Math.max(0.75, requestedScale!))
    : 1;
  const requestedWeight = analysis?.exportOptions?.chartLabelFontWeight ?? presetDefaults?.chartLabelFontWeight;
  const labelWeight = Number.isFinite(requestedWeight)
    ? Math.min(900, Math.max(400, requestedWeight!))
    : undefined;

  return {
    ...styles,
    labels: { scale: labelScale, fontWeight: labelWeight },
    grid: {
      ...styles.grid,
      stroke: colors.gridLine,
    },
    xAxis: {
      ...styles.xAxis,
      stroke: colors.axisLine,
      tick: {
        ...styles.xAxis.tick,
        fill: colors.axisLabel,
        fontSize: styles.xAxis.tick.fontSize * labelScale,
        fontWeight: labelWeight ?? styles.xAxis.tick.fontWeight,
      },
      axisLine: {
        ...(typeof styles.xAxis.axisLine === "object" ? styles.xAxis.axisLine : {}),
        stroke: colors.axisLine,
      },
    },
    yAxis: {
      ...styles.yAxis,
      stroke: colors.axisLine,
      tick: {
        ...styles.yAxis.tick,
        fill: colors.axisLabel,
        fontSize: styles.yAxis.tick.fontSize * labelScale,
        fontWeight: labelWeight ?? styles.yAxis.tick.fontWeight,
      },
    },
    tooltip: {
      ...styles.tooltip,
      contentStyle: {
        ...styles.tooltip.contentStyle,
        background: colors.tooltipBg,
        border: `1px solid ${colors.tooltipBorder}`,
      },
      labelStyle: {
        ...styles.tooltip.labelStyle,
        color: colors.textSecondary,
      },
      itemStyle: {
        ...styles.tooltip.itemStyle,
        color: colors.textPrimary,
      },
      cursor: {
        ...styles.tooltip.cursor,
        stroke: colors.crosshair,
      },
    },
  };
}
