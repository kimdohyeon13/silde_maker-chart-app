/**
 * =====================================================
 * TossTable — 토스증권 스타일 표 컴포넌트
 * =====================================================
 *
 * 원본 이미지에서 추출한 표 데이터를 깔끔하게 렌더링합니다.
 *
 * 토스 스타일 표의 핵심:
 * 1. 세로선 없음 — 가로선만으로 행 구분 (미니멀)
 * 2. 압축 여백 — 발표 장표에서 표가 지나치게 길어지지 않게 조정
 * 3. 숫자는 모노스페이스 — 정렬이 맞아야 비교 가능
 * 4. 강조는 색상으로 — 볼드/밑줄 대신 배경색으로 시선 유도
 * 5. 합계/소계 행 구분 — 시각적 위계 표현
 *
 * 왜 순수 <table> + inline style인가?
 * → html-to-image로 PNG 캡처할 때 외부 CSS 의존성이 없어야 함
 * → Tailwind 클래스는 캡처 시 누락될 수 있음
 */

"use client";

import React from "react";
import type {
  ExportOptions,
  TableAnalysis,
  TableCell,
  TableColumn,
  TableRow,
  TableVisualOptions,
} from "@/lib/analysis/schema";
import {
  getAnalysisStylePreset,
  getAnalysisThemeMode,
  getPresetColors,
} from "@/lib/style-presets";
import { getTheme, type ThemeMode } from "@/lib/theme/toss-theme";
import { chartSettings } from "@/lib/chart-settings";
import {
  resolveDataBarStyle,
  resolveTableColumnGroups,
  resolveTableFontWeights,
  resolveTableVisualStyle,
} from "@/lib/table-visual-style";
import {
  mergeOptionDefaults,
  mergeTableVisualDefaults,
} from "@/lib/visual-system-options";
import { resolveAdaptiveTableRowHeight } from "@/lib/table-layout";

interface TossTableProps {
  analysis: TableAnalysis;
  theme?: ThemeMode;
}

export default function TossTable({
  analysis,
  theme: themeMode = "dark",
}: TossTableProps) {
  const renderThemeMode = getAnalysisThemeMode(analysis, themeMode);
  const theme = getTheme(renderThemeMode);
  const preset = getAnalysisStylePreset(analysis);
  const colors = getPresetColors(preset, renderThemeMode);
  const { typography } = theme;
  const { tableData } = analysis;
  const { columns, rows } = tableData;
  const columnGroups = resolveTableColumnGroups(
    columns.map((column) => column.key),
    tableData.columnGroups ?? [],
  );
  const visualOptions = mergeTableVisualDefaults<TableVisualOptions>(
    preset.tableDefaults,
    tableData.visualOptions,
  );
  const exportOptions = mergeOptionDefaults<ExportOptions>(
    preset.exportDefaults,
    analysis.exportOptions,
  );
  const baseRowHeight =
    visualOptions.rowHeight ??
    Math.max(30, chartSettings.table.rowHeight + preset.table.rowHeightDelta);
  const dataRowCount = rows.filter(
    (row) => !row.rowType || row.rowType === "data" || row.rowType === "subtotal" || row.rowType === "total",
  ).length;
  const groupRowCount = rows.filter((row) => row.rowType === "header").length;
  const resolvedRowHeight = visualOptions.fitRowsToCanvas
    ? resolveAdaptiveTableRowHeight({
        canvasHeight: exportOptions.canvasHeight,
        dataRowCount,
        groupRowCount,
        baseRowHeight,
        minRowHeight: visualOptions.minRowHeight,
        maxRowHeight: visualOptions.maxRowHeight,
      })
    : baseRowHeight;
  const ts = {
    ...chartSettings.table,
    ...visualOptions,
    rowHeight: resolvedRowHeight,
    zebraStripe:
      visualOptions.zebraStripe ??
      preset.table.zebraStripe ??
      chartSettings.table.zebraStripe,
    highlightMode:
      visualOptions.highlightMode ??
      preset.table.highlightMode ??
      "background",
    fontSize: {
      ...chartSettings.table.fontSize,
      ...visualOptions.fontSize,
    },
  };
  const isDark = renderThemeMode === "dark";
  const squareEdges = !!exportOptions.squareEdges;
  const tableStyle = resolveTableVisualStyle(
    visualOptions,
    colors,
    squareEdges,
  );
  const fontWeights = resolveTableFontWeights(visualOptions.fontWeight);
  const dataBarConfigByKey = new Map(
    (visualOptions.dataBarColumns ?? []).map((config) => [
      config.key,
      config,
    ]),
  );
  const dataBarMaxByKey = new Map<string, number>();

  for (const [key, config] of dataBarConfigByKey) {
    if (Number.isFinite(config.max) && (config.max ?? 0) > 0) {
      dataBarMaxByKey.set(key, Math.abs(config.max!));
      continue;
    }

    const maxMagnitude = rows.reduce((max, row) => {
      if (row.rowType && row.rowType !== "data") return max;
      const value = row.cells[key]?.value;
      return typeof value === "number" && Number.isFinite(value)
        ? Math.max(max, Math.abs(value))
        : max;
    }, 0);
    dataBarMaxByKey.set(key, maxMagnitude);
  }

  // 셀 강조 배경색 가져오기
  function getCellBg(highlight?: TableCell["highlight"]): string | undefined {
    if (ts.highlightMode === "text") return undefined;
    if (!highlight || highlight === "none") return undefined;
    // 라이트 모드에서도 같은 반투명 색상을 사용 (배경과 잘 어울림)
    return ts.highlightCellBg[highlight as keyof typeof ts.highlightCellBg];
  }

  // 셀 텍스트 색상 (highlight에 따라)
  function getCellColor(highlight?: TableCell["highlight"]): string {
    switch (highlight) {
      case "positive":
        return colors.positive;
      case "negative":
        return colors.negative;
      case "warning":
        return colors.warning;
      case "accent":
        return colors.accent;
      case "muted":
        return colors.textTertiary;
      default:
        return colors.textPrimary;
    }
  }

  // 열의 정렬 방향 결정
  function getAlign(col: TableColumn): "left" | "center" | "right" {
    if (col.align) return col.align;
    // 데이터 타입에 따라 자동 결정
    switch (col.dataType) {
      case "number":
      case "percent":
      case "currency":
        return "right";
      case "date":
      case "badge":
        return "center";
      default:
        return "left";
    }
  }

  // 숫자 관련 데이터 타입인지 확인
  function isNumericType(col: TableColumn): boolean {
    return col.dataType === "number" || col.dataType === "percent" || col.dataType === "currency";
  }

  // 행 배경색 결정
  function getRowBg(row: TableRow, index: number): string | undefined {
    if (row.highlightBg) return row.highlightBg;
    if (row.highlight) return isDark ? "rgba(88, 166, 255, 0.08)" : "rgba(9, 105, 218, 0.06)";
    if (row.rowType === "total" || row.rowType === "subtotal") {
      return isDark ? "rgba(230, 237, 243, 0.04)" : "rgba(31, 35, 40, 0.03)";
    }
    // zebra stripe: 짝수 행에 살짝 다른 배경
    if (ts.zebraStripe && index % 2 === 1) {
      return isDark
        ? `rgba(230, 237, 243, ${ts.zebraOpacity})`
        : `rgba(31, 35, 40, ${ts.zebraOpacity})`;
    }
    return undefined;
  }

  // 셀 렌더링
  function renderCell(col: TableColumn, cell: TableCell | undefined, rowType?: TableRow["rowType"]) {
    if (!cell) return null;

    const displayText = cell.displayValue ?? String(cell.value);
    const lines = String(displayText).split("\n");
    const isTotal = rowType === "total" || rowType === "subtotal";
    const cellBg = getCellBg(cell.highlight);
    const hasSideValue = Boolean(cell.sideValue);
    const dataBarConfig = dataBarConfigByKey.get(col.key);
    const dataBarValue =
      dataBarConfig &&
      isNumericType(col) &&
      (!rowType || rowType === "data") &&
      typeof cell.value === "number"
        ? cell.value
        : undefined;
    const dataBarColor =
      dataBarValue != null && dataBarValue < 0
        ? dataBarConfig?.negativeColor ?? colors.negative
        : dataBarValue != null && dataBarValue > 0
          ? dataBarConfig?.positiveColor ?? dataBarConfig?.color ?? colors.accent
          : dataBarConfig?.color ?? colors.accent;
    const dataBarStyle =
      dataBarValue == null
        ? undefined
        : resolveDataBarStyle(
            dataBarValue,
            dataBarMaxByKey.get(col.key) ?? 0,
            dataBarColor,
            visualOptions.dataBarStyle,
          );

    return (
      <td
        key={col.key}
        colSpan={cell.colSpan}
        rowSpan={cell.rowSpan}
        style={{
          padding: ts.cellPadding,
          textAlign: getAlign(col),
          fontFamily: ts.fontFamily ?? (isNumericType(col) ? typography.fontFamily.mono : typography.fontFamily.sans),
          fontSize: isTotal ? ts.fontSize.total : ts.fontSize.body,
          fontWeight: isTotal
            ? fontWeights.total
            : col.isRowHeader
              ? fontWeights.rowHeader
              : isNumericType(col)
                ? fontWeights.numeric
                : fontWeights.body,
          color: getCellColor(cell.highlight),
          background: cellBg,
          borderBottom: tableStyle.cell.borderBottom,
          borderRight: tableStyle.cell.borderRight,
          borderLeft: col.sectionStart ? tableStyle.sectionDivider : undefined,
          whiteSpace: displayText.includes("\n") || !isNumericType(col) ? "pre-line" : "nowrap",
          wordBreak: "keep-all",
          overflowWrap: isNumericType(col) ? "normal" : "break-word",
          lineHeight: ts.lineHeight,
          minHeight: ts.rowHeight,
          height: ts.rowHeight,
          verticalAlign: "top",
          position: "relative",
          fontVariantNumeric: isNumericType(col) ? "tabular-nums lining-nums" : undefined,
          fontFeatureSettings: isNumericType(col) ? '"tnum" 1, "lnum" 1' : undefined,
        }}
      >
        {dataBarStyle && (
          <span
            aria-hidden="true"
            style={{
              position: "absolute",
              right: 4,
              zIndex: 0,
              pointerEvents: "none",
              ...dataBarStyle,
            }}
          />
        )}
        <span style={{ position: "relative", zIndex: 1 }}>
          {hasSideValue ? (
            <span style={{ display: "block" }}>
              <span style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                <span>{lines[0]}</span>
                <span
                  style={{
                    color: cell.sideValue?.color ?? getCellColor(cell.sideValue?.highlight),
                    background: cell.sideValue?.background,
                    border: cell.sideValue?.border,
                    borderRadius: squareEdges ? 0 : cell.sideValue?.borderRadius,
                    padding: cell.sideValue?.padding,
                    display: "inline-flex",
                    alignItems: "center",
                    fontSize: cell.sideValue?.fontSize ?? ts.fontSize.body,
                    fontWeight: cell.sideValue?.fontWeight ?? 900,
                    lineHeight: 1,
                    whiteSpace: "nowrap",
                  }}
                >
                  {cell.sideValue?.displayValue}
                </span>
              </span>
              {lines.length > 1 && (
                <span style={{ display: "block", whiteSpace: "pre-line" }}>
                  {lines.slice(1).join("\n")}
                </span>
              )}
            </span>
          ) : (
            displayText
          )}
          {/* 뱃지 — 셀 텍스트 옆에 작은 태그 */}
          {cell.badge && (
            <span
              style={{
                marginLeft: 6,
                padding: "2px 6px",
                borderRadius: tableStyle.badgeRadius,
                fontSize: ts.fontSize.badge,
                fontWeight: 600,
                fontFamily: typography.fontFamily.sans,
                background: colors.accentSubtle,
                color: colors.accent,
                verticalAlign: "middle",
              }}
            >
              {cell.badge}
            </span>
          )}
        </span>
      </td>
    );
  }

  return (
    <div
      style={{
        width: "100%",
        overflowX: "auto",
        fontFamily: ts.fontFamily ?? typography.fontFamily.sans,
      }}
    >
      <table
        style={{
          width: "100%",
          tableLayout: "fixed",
          borderCollapse: "collapse",
          // 세로선 없음! 토스 스타일의 핵심
          borderSpacing: 0,
        }}
      >
        {/* ── 열 너비 지정 ── */}
        <colgroup>
          {columns.map((col) => (
            <col
              key={col.key}
              style={{
                width: col.width
                  ? typeof col.width === "number"
                    ? `${col.width}px`
                    : col.width
                  : undefined,
              }}
            />
          ))}
        </colgroup>

        {/* ── 헤더 행 ── */}
        <thead>
          {tableData.columnGroups && tableData.columnGroups.length > 0 && (
            <tr>
              {columnGroups.map((group, groupIndex) => (
                <th
                  key={`${group.keys[0]}-${groupIndex}`}
                  scope="colgroup"
                  colSpan={group.colSpan}
                  data-column-group={group.label || "ungrouped"}
                  style={{
                    padding: "4px 8px 3px",
                    textAlign: "center",
                    fontFamily: ts.fontFamily ?? typography.fontFamily.sans,
                    fontSize: ts.fontSize.columnGroup ?? ts.fontSize.unit,
                    fontWeight: fontWeights.columnGroup,
                    letterSpacing: "0.04em",
                    color: colors.textTertiary,
                    background:
                      visualOptions.columnGroupTone === "tinted"
                        ? colors.surfaceHover
                        : "transparent",
                    borderBottom: `1px solid ${visualOptions.rowRuleColor ?? colors.borderSubtle}`,
                    borderLeft:
                      groupIndex > 0
                        ? `1px solid ${visualOptions.sectionRuleColor ?? colors.borderSubtle}`
                        : undefined,
                    whiteSpace: "nowrap",
                    lineHeight: 1.1,
                  }}
                >
                  {group.label}
                </th>
              ))}
            </tr>
          )}
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                style={{
                  padding: ts.cellPadding,
                  textAlign: getAlign(col),
                  fontFamily: ts.fontFamily ?? typography.fontFamily.sans,
                  fontSize: ts.fontSize.header,
                  fontWeight: fontWeights.header,
                  color: tableStyle.header.color,
                  background: tableStyle.header.background,
                  borderBottom: tableStyle.header.borderBottom,
                  borderRight: tableStyle.cell.borderRight,
                  borderLeft: col.sectionStart ? tableStyle.sectionDivider : undefined,
                  whiteSpace: "pre-line",
                  lineHeight: ts.lineHeight,
                  height: ts.rowHeight,
                  verticalAlign: "bottom",
                  textTransform: preset.table.headerTransform === "uppercase" ? "uppercase" : "none",
                  fontVariantNumeric: isNumericType(col) ? "tabular-nums lining-nums" : undefined,
                  fontFeatureSettings: isNumericType(col) ? '"tnum" 1, "lnum" 1' : undefined,
                }}
              >
                {col.label}
                {/* 단위가 있으면 작게 표�� */}
                {col.unit && (
                  <span style={{ fontSize: ts.fontSize.unit, fontWeight: 500, marginLeft: 4 }}>
                    ({col.unit})
                  </span>
                )}
              </th>
            ))}
          </tr>
        </thead>

        {/* ── 데이터 행들 ── */}
        <tbody>
          {rows.map((row, rowIndex) => {
            // 구분선 행
            if (row.rowType === "divider") {
              return (
                <tr key={rowIndex}>
                  <td
                    colSpan={columns.length}
                    style={{
                      height: 1,
                      padding: 0,
                      background: colors.borderSubtle,
                    }}
                  />
                </tr>
              );
            }

            // 그룹 헤더 행
            if (row.rowType === "header") {
              const firstCell = Object.values(row.cells)[0];
              return (
                <tr key={rowIndex}>
                  <td
                    colSpan={columns.length}
                    style={{
                      padding: "8px 14px 4px",
                      fontSize: ts.fontSize.groupHeader,
                      fontWeight: fontWeights.groupHeader,
                      fontFamily: ts.fontFamily ?? typography.fontFamily.sans,
                      color: tableStyle.groupHeader.color,
                      background: tableStyle.groupHeader.background,
                      letterSpacing: "0.05em",
                      textTransform: "uppercase" as const,
                      borderBottom: tableStyle.groupHeader.borderBottom,
                      borderLeft: tableStyle.groupHeader.borderLeft,
                    }}
                  >
                    {firstCell?.displayValue ?? String(firstCell?.value ?? "")}
                  </td>
                </tr>
              );
            }

            // 합계/소계 행 — 위에 굵은 구분선
            const isTotal = row.rowType === "total" || row.rowType === "subtotal";

            return (
              <tr
                key={rowIndex}
                style={{
                  background: getRowBg(row, rowIndex),
                  borderTop: isTotal
                    ? `2px solid ${colors.borderSubtle}`
                    : undefined,
                }}
              >
                {columns.map((col) => renderCell(col, row.cells[col.key], row.rowType))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
