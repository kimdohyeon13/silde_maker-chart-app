"use client";

import type { ExportOptions } from "@/lib/analysis/schema";
import { resolveCenteredTitleFontSize, resolveHeaderLayout } from "@/lib/export-layout";
import { resolveSubMessageWeight } from "@/lib/slide-typography";

interface ExportCardHeaderProps {
  headMessage: string;
  subMessage?: string;
  metaMessage?: string;
  exportOptions: ExportOptions;
  defaultPadding: string;
  defaultTitleFontSize: number;
  defaultSubtitleFontSize: number;
  defaultSourceFontSize: number;
  defaultFontFamily: string;
  titleWeight: number;
  subtitleWeight: number;
  titleLetterSpacing: number;
  textPrimary: string;
  textSecondary: string;
  textTertiary: string;
}

export default function ExportCardHeader({
  headMessage,
  subMessage,
  metaMessage,
  exportOptions,
  defaultPadding,
  defaultTitleFontSize,
  defaultSubtitleFontSize,
  defaultSourceFontSize,
  defaultFontFamily,
  titleWeight,
  subtitleWeight,
  titleLetterSpacing,
  textPrimary,
  textSecondary,
  textTertiary,
}: ExportCardHeaderProps) {
  const accentColor = exportOptions.accentColor ?? textPrimary;
  const layout = resolveHeaderLayout(exportOptions.headerVariant, accentColor);
  const fontFamily = exportOptions.fontFamily ?? defaultFontFamily;
  const titleFontFamily = exportOptions.titleFontFamily ?? fontFamily;
  const titleFontSize = resolveCenteredTitleFontSize(
    headMessage,
    defaultTitleFontSize,
    exportOptions.titleFontSize,
    exportOptions.headerVariant,
  );
  const sessionMoveItems = exportOptions.sessionMoveItems ?? [];
  const hasSessionMoveStrip = sessionMoveItems.length > 0;
  const sessionMoveBlockBasis = sessionMoveItems.length <= 5 ? 118 : 92;
  const sessionMoveColor = (direction: "up" | "down" | "flat") => {
    if (direction === "up") return "#16A34A";
    if (direction === "down") return "#C2410C";
    return "#667085";
  };
  const sessionMoveArrow = (direction: "up" | "down" | "flat") => {
    if (direction === "up") return "▲";
    if (direction === "down") return "▼";
    return "■";
  };

  return (
    <div data-export-header style={{ padding: exportOptions.headerPadding ?? defaultPadding }}>
      <div style={layout.container}>
        {exportOptions.headerLabel && (
          <div
            style={{
              color: accentColor,
              fontFamily,
              fontSize: exportOptions.headerLabelFontSize ?? Math.max(11, defaultSourceFontSize),
              fontWeight: 900,
              letterSpacing: "0.12em",
              lineHeight: 1.2,
              marginBottom: 6,
              textTransform: "uppercase",
            }}
          >
            {exportOptions.headerLabel}
          </div>
        )}

        <div style={layout.main}>
          <div style={layout.copy}>
            <h2
              style={{
                color: textPrimary,
                fontSize: titleFontSize,
                fontWeight: titleWeight,
                fontFamily: titleFontFamily,
                letterSpacing: exportOptions.titleLetterSpacing ?? titleLetterSpacing,
                margin: 0,
                lineHeight: exportOptions.titleLineHeight ?? 1.22,
                textWrap: "balance",
                wordBreak: "keep-all",
              }}
            >
              {headMessage}
            </h2>
            {subMessage && !hasSessionMoveStrip && (
              <p
                style={{
                  color: textSecondary,
                  fontSize: exportOptions.subtitleFontSize ?? defaultSubtitleFontSize,
                  fontFamily,
                  margin: "5px 0 0",
                  lineHeight: 1.38,
                  fontWeight: resolveSubMessageWeight(
                    exportOptions.subtitleFontWeight,
                    subtitleWeight,
                  ),
                  whiteSpace: exportOptions.headerCopySingleLine ? "nowrap" : undefined,
                }}
              >
                {subMessage}
              </p>
            )}
            {hasSessionMoveStrip && (
              <div
                data-session-move-strip
                style={{
                  display: "flex",
                  alignItems: "stretch",
                  gap: 5,
                  marginTop: 7,
                  width: "100%",
                  minWidth: 0,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    color: textSecondary,
                    fontFamily,
                    fontSize: 11.5,
                    fontWeight: 900,
                    lineHeight: 1.15,
                    minWidth: 88,
                    whiteSpace: "nowrap",
                  }}
                >
                  {exportOptions.sessionMoveTitle ?? "오늘 등락"}
                </div>
                {sessionMoveItems.map((item) => (
                  <div
                    key={`${item.label}-${item.value}`}
                    style={{
                      alignItems: "stretch",
                      background: sessionMoveColor(item.direction),
                      borderRadius: exportOptions.squareEdges ? 0 : 5,
                      color: "#FFFFFF",
                      display: "flex",
                      flexDirection: "column",
                      flex: `0 1 ${sessionMoveBlockBasis}px`,
                      fontFamily,
                      gap: 2,
                      justifyContent: "center",
                      minWidth: 0,
                      minHeight: 36,
                      padding: "4px 8px",
                    }}
                  >
                    <span
                      style={{
                        fontSize: 10.5,
                        fontWeight: 800,
                        lineHeight: 1.05,
                        overflowWrap: "anywhere",
                        whiteSpace: "normal",
                        wordBreak: "keep-all",
                      }}
                    >
                      {item.label}
                    </span>
                    <span
                      style={{
                        fontSize: 14.5,
                        fontWeight: 950,
                        letterSpacing: "-0.03em",
                        lineHeight: 1,
                        textAlign: "left",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {sessionMoveArrow(item.direction)} {item.value}
                    </span>
                  </div>
                ))}
              </div>
            )}
            {metaMessage && (
              <p
                style={{
                  color: textTertiary,
                  fontSize:
                    exportOptions.metaFontSize ??
                    exportOptions.sourceFontSize ??
                    defaultSourceFontSize,
                  fontFamily,
                  margin: "6px 0 0",
                  lineHeight: 1.35,
                  fontWeight: exportOptions.metaFontWeight ?? 600,
                  whiteSpace: exportOptions.headerCopySingleLine ? "nowrap" : undefined,
                }}
              >
                {metaMessage}
              </p>
            )}
          </div>

          {layout.showMetric && exportOptions.metricValue && (
            <div style={{ textAlign: "right", whiteSpace: "nowrap" }}>
              <div
                style={{
                  color: exportOptions.metricColor ?? accentColor,
                  fontFamily: exportOptions.metricFontFamily ?? fontFamily,
                  fontSize: exportOptions.metricFontSize ?? Math.round(titleFontSize * 1.45),
                  fontWeight: 950,
                  lineHeight: 0.95,
                  letterSpacing: "-0.04em",
                }}
              >
                {exportOptions.metricValue}
              </div>
              {exportOptions.metricLabel && (
                <div
                  style={{
                    color: textSecondary,
                    fontFamily,
                    fontSize: exportOptions.sourceFontSize ?? defaultSourceFontSize,
                    fontWeight: 800,
                    marginTop: 6,
                  }}
                >
                  {exportOptions.metricLabel}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
