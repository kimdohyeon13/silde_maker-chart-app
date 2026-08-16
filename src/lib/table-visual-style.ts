export type TableHeaderTone = "plain" | "tinted" | "inverse" | "underline";
export type TableRowRules = "none" | "soft" | "strong";
export type TableGroupHeaderTone = "plain" | "band" | "accent-rule";

export interface TableVisualStyleControls {
  headerTone?: TableHeaderTone;
  rowRules?: TableRowRules;
  groupHeaderTone?: TableGroupHeaderTone;
  columnRules?: boolean;
  sectionRules?: boolean;
  accentColor?: string;
  rowRuleColor?: string;
  sectionRuleColor?: string;
}

export interface TableDataBarStyleControls {
  minWidthPercent?: number;
  maxWidthPercent?: number;
  height?: number;
  opacity?: number;
  bottom?: number;
}

export interface TableColumnGroupDefinition {
  label: string;
  keys: string[];
}

export interface ResolvedTableColumnGroup {
  label: string;
  keys: string[];
  colSpan: number;
}

export interface TableFontWeightControls {
  body?: number;
  numeric?: number;
  rowHeader?: number;
  header?: number;
  total?: number;
  groupHeader?: number;
  columnGroup?: number;
}

export interface TableVisualPalette {
  surfaceHover: string;
  textPrimary: string;
  textSecondary: string;
  borderSubtle: string;
  accent: string;
  accentSubtle: string;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function resolveFontWeight(value: number | undefined, fallback: number): number {
  return value != null && Number.isFinite(value)
    ? clamp(Math.round(value), 100, 900)
    : fallback;
}

/** 명시한 표 강조색을 같은 색의 옅은 그룹 행 배경으로 바꾼다. */
function resolveAccentSubtle(accentColor: string | undefined, fallback: string): string {
  if (!accentColor) return fallback;

  const normalized = accentColor.trim();
  const shortHex = /^#([0-9a-f]{3})$/i.exec(normalized);
  const longHex = /^#([0-9a-f]{6})$/i.exec(normalized);
  const hex = shortHex
    ? shortHex[1]
        .split("")
        .map((value) => `${value}${value}`)
        .join("")
    : longHex?.[1];

  if (!hex) return fallback;

  const red = Number.parseInt(hex.slice(0, 2), 16);
  const green = Number.parseInt(hex.slice(2, 4), 16);
  const blue = Number.parseInt(hex.slice(4, 6), 16);
  return `rgba(${red}, ${green}, ${blue}, 0.08)`;
}

/** 표의 역할별 글자 굵기를 분리해 모든 숫자가 동시에 강조되는 것을 막습니다. */
export function resolveTableFontWeights(controls: TableFontWeightControls = {}) {
  return {
    body: resolveFontWeight(controls.body, 700),
    numeric: resolveFontWeight(controls.numeric, 800),
    rowHeader: resolveFontWeight(controls.rowHeader, 800),
    header: resolveFontWeight(controls.header, 800),
    total: resolveFontWeight(controls.total, 800),
    groupHeader: resolveFontWeight(controls.groupHeader, 800),
    columnGroup: resolveFontWeight(controls.columnGroup, 700),
  };
}

/**
 * 열 그룹 정의를 실제 표 열 순서에 맞는 연속 헤더 셀로 바꿉니다.
 * 첫 번째 그룹 정의가 중복 key의 소유권을 가지며, 빠진 열도 빈 그룹으로 보존해
 * colSpan 합계가 항상 전체 열 수와 같도록 합니다.
 */
export function resolveTableColumnGroups(
  columnKeys: string[],
  groups: TableColumnGroupDefinition[],
): ResolvedTableColumnGroup[] {
  const validKeys = new Set(columnKeys);
  const ownerByKey = new Map<string, { id: number; label: string }>();

  groups.forEach((group, groupIndex) => {
    group.keys.forEach((key) => {
      if (validKeys.has(key) && !ownerByKey.has(key)) {
        ownerByKey.set(key, { id: groupIndex, label: group.label });
      }
    });
  });

  const resolved: Array<ResolvedTableColumnGroup & { ownerId: string }> = [];

  columnKeys.forEach((key) => {
    const owner = ownerByKey.get(key);
    const ownerId = owner ? `group-${owner.id}` : "ungrouped";
    const previous = resolved.at(-1);

    if (previous?.ownerId === ownerId) {
      previous.keys.push(key);
      previous.colSpan += 1;
      return;
    }

    resolved.push({
      ownerId,
      label: owner?.label ?? "",
      keys: [key],
      colSpan: 1,
    });
  });

  return resolved.map((group) => ({
    label: group.label,
    keys: group.keys,
    colSpan: group.colSpan,
  }));
}

/**
 * 숫자 셀 아래에 그릴 얇은 데이터 바 스타일을 계산합니다.
 * 값의 부호는 색으로, 크기는 절댓값 비율로 표현합니다.
 */
export function resolveDataBarStyle(
  value: number,
  maxMagnitude: number,
  color: string,
  controls: TableDataBarStyleControls = {},
) {
  if (!Number.isFinite(value) || value === 0 || !Number.isFinite(maxMagnitude) || maxMagnitude <= 0) {
    return undefined;
  }

  const maxWidthPercent = clamp(controls.maxWidthPercent ?? 88, 1, 100);
  const minWidthPercent = clamp(controls.minWidthPercent ?? 8, 0, maxWidthPercent);
  const ratio = clamp(Math.abs(value) / maxMagnitude, 0, 1);
  const width = clamp(ratio * maxWidthPercent, minWidthPercent, maxWidthPercent);

  return {
    background: color,
    bottom: Math.max(0, controls.bottom ?? 5),
    height: Math.max(1, controls.height ?? 3),
    opacity: clamp(controls.opacity ?? 0.22, 0, 1),
    width: `${Number(width.toFixed(2))}%`,
  };
}

export function resolveTableVisualStyle(
  controls: TableVisualStyleControls,
  palette: TableVisualPalette,
  squareEdges: boolean,
) {
  const accentColor = controls.accentColor ?? palette.accent;
  const accentSubtle = resolveAccentSubtle(controls.accentColor, palette.accentSubtle);
  const ruleColor = controls.rowRuleColor ?? palette.borderSubtle;
  const sectionRuleColor = controls.sectionRuleColor ?? ruleColor;
  const headerTone = controls.headerTone ?? "tinted";
  const groupHeaderTone = controls.groupHeaderTone ?? "plain";

  const header = (() => {
    if (headerTone === "inverse") {
      return {
        background: accentColor,
        color: "#FFFFFF",
        borderBottom: `2px solid ${accentColor}`,
      };
    }
    if (headerTone === "underline") {
      return {
        background: "transparent",
        color: palette.textPrimary,
        borderBottom: `3px solid ${palette.textPrimary}`,
      };
    }
    if (headerTone === "plain") {
      return {
        background: "transparent",
        color: palette.textSecondary,
        borderBottom: `1px solid ${ruleColor}`,
      };
    }
    return {
      background: palette.surfaceHover,
      color: palette.textSecondary,
      borderBottom: `2px solid ${ruleColor}`,
    };
  })();

  const rowRuleWidth =
    controls.rowRules === "none"
      ? 0
      : controls.rowRules === "strong"
        ? 2
        : controls.rowRules === "soft"
          ? 1
          : 1.5;

  const groupHeader = (() => {
    if (groupHeaderTone === "band") {
      return {
        background: accentSubtle,
        color: accentColor,
        borderBottom: `1px solid ${ruleColor}`,
        borderLeft: undefined,
      };
    }
    if (groupHeaderTone === "accent-rule") {
      return {
        background: "transparent",
        color: palette.textSecondary,
        borderBottom: `1px solid ${ruleColor}`,
        borderLeft: `5px solid ${accentColor}`,
      };
    }
    return {
      background: "transparent",
      color: palette.textSecondary,
      borderBottom: `1px solid ${ruleColor}`,
      borderLeft: undefined,
    };
  })();

  return {
    header,
    cell: {
      borderBottom: rowRuleWidth > 0 ? `${rowRuleWidth}px solid ${ruleColor}` : "0",
      borderRight: controls.columnRules ? `1px solid ${ruleColor}` : undefined,
    },
    groupHeader,
    sectionDivider: controls.sectionRules ? `2px solid ${sectionRuleColor}` : undefined,
    badgeRadius: squareEdges ? 0 : 4,
  };
}
