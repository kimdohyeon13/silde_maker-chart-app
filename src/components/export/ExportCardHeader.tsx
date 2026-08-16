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
            {subMessage && (
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
                }}
              >
                {subMessage}
              </p>
            )}
            {metaMessage && (
              <p
                style={{
                  color: textTertiary,
                  fontSize: exportOptions.sourceFontSize ?? defaultSourceFontSize,
                  fontFamily,
                  margin: "6px 0 0",
                  lineHeight: 1.35,
                  fontWeight: 600,
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
