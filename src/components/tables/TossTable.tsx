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
import type { TableAnalysis, TableCell, TableColumn, TableRow } from "@/lib/analysis/schema";
import {
  getAnalysisStylePreset,
  getAnalysisThemeMode,
  getPresetColors,
} from "@/lib/style-presets";
import { getTheme, type ThemeMode } from "@/lib/theme/toss-theme";
import { chartSettings } from "@/lib/chart-settings";

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
  const ts = {
    ...chartSettings.table,
    ...tableData.visualOptions,
    rowHeight:
      tableData.visualOptions?.rowHeight ??
      Math.max(30, chartSettings.table.rowHeight + preset.table.rowHeightDelta),
    zebraStripe:
      tableData.visualOptions?.zebraStripe ??
      preset.table.zebraStripe ??
      chartSettings.table.zebraStripe,
    highlightMode:
      tableData.visualOptions?.highlightMode ??
      preset.table.highlightMode ??
      "background",
    fontSize: {
      ...chartSettings.table.fontSize,
      ...tableData.visualOptions?.fontSize,
    },
  };
  const isDark = renderThemeMode === "dark";

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
    const isTotal = rowType === "total" || rowType === "subtotal";
    const cellBg = getCellBg(cell.highlight);

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
          fontWeight: isTotal || col.isRowHeader ? 800 : isNumericType(col) ? 800 : 700,
          color: getCellColor(cell.highlight),
          background: cellBg,
          borderBottom: `1.5px solid ${colors.borderSubtle}`,
          whiteSpace: displayText.includes("\n") || !isNumericType(col) ? "pre-line" : "nowrap",
          wordBreak: "keep-all",
          overflowWrap: isNumericType(col) ? "normal" : "break-word",
          lineHeight: ts.lineHeight,
          minHeight: ts.rowHeight,
          height: ts.rowHeight,
          verticalAlign: "top",
          position: "relative",
        }}
      >
        {displayText}
        {/* 뱃지 — 셀 텍스트 옆에 작은 태그 */}
        {cell.badge && (
          <span
            style={{
              marginLeft: 6,
              padding: "2px 6px",
              borderRadius: 4,
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
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                style={{
                  padding: ts.cellPadding,
                  textAlign: getAlign(col),
                  fontFamily: ts.fontFamily ?? typography.fontFamily.sans,
                  fontSize: ts.fontSize.header,
                  fontWeight: 800,
                  color: colors.textSecondary,
                  background: isDark
                    ? colors.surfaceHover
                    : colors.surfaceHover,
                  borderBottom: `2px solid ${colors.borderSubtle}`,
                  whiteSpace: "pre-line",
                  lineHeight: ts.lineHeight,
                  height: ts.rowHeight,
                  verticalAlign: "bottom",
                  textTransform: preset.table.headerTransform === "uppercase" ? "uppercase" : "none",
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
                      fontWeight: 800,
                      fontFamily: ts.fontFamily ?? typography.fontFamily.sans,
                      color: colors.textSecondary,
                      letterSpacing: "0.05em",
                      textTransform: "uppercase" as const,
                      borderBottom: `1px solid ${colors.borderSubtle}`,
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
