/**
 * =====================================================
 * Export 페이지 — 콘텐츠를 PNG/JPG로 내보내기
 * =====================================================
 *
 * 역할:
 * → 차트/표/뉴스 브리프를 깔끔하게 렌더링 (인사이트/설명 없이)
 * → "모두 다운로드" 버튼으로 한번에 PNG 저장
 * → 컨설팅 장표 수준의 순수 흰색 배경
 * → 프로젝트/테마 상태는 공용 훅으로 관리
 *
 * 설정:
 * → chart-settings.ts의 export 섹션에서 배경색, 테두리 등 조절 가능
 *
 * html-to-image 라이브러리란?
 * → HTML 요소(DOM)를 캡처해서 PNG/JPG 이미지로 변환하는 라이브러리
 * → 내부적으로 <canvas>를 사용해서 DOM을 그림으로 바꿈
 * → 브라우저에서 직접 실행되므로 서버 없이도 동작
 */

"use client";

import { useRef, useState } from "react";
import ActionButton from "@/components/app/ActionButton";
import PageShell from "@/components/app/PageShell";
import ProjectSelectBar from "@/components/app/ProjectSelectBar";
import StatusPanel from "@/components/app/StatusPanel";
import { toPng } from "html-to-image";
import type { ExportOptions, VisualAnalysis } from "@/lib/analysis/schema";
import { isChartAnalysis } from "@/lib/analysis/schema";
import { ContentRouter } from "@/components/charts";
import { getDisplayMessages } from "@/lib/analysis/message-agent";
import { useProjectBrowser } from "@/hooks/use-project-browser";
import { useThemeMode } from "@/hooks/use-theme-mode";
import { chartSettings } from "@/lib/chart-settings";
import {
  getAnalysisStylePreset,
  getAnalysisThemeMode,
  getPresetColors,
} from "@/lib/style-presets";
import { getTheme } from "@/lib/theme/toss-theme";

// ─────────────────────────────────────────────
// 다중 패널 차트 높이 계산용 지역 상수 (D3)
// → 다중 패널(structure.panels)이 ~160px로 작게 렌더되면 라인 진폭이
//   압축돼 밋밋하고, 패널 내부 X축 라벨도 겹친다.
// → 그래서 패널 수에 비례해 전체 height를 키워, 각 패널이 충분히 크게(약 260px)
//   그려지도록 export 단계에서 동적으로 height를 산출한다.
// ⚠️ 단일 차트(panels 없음)는 기존 350을 그대로 유지한다.
// ⚠️ chart-settings.ts는 다른 에이전트가 작업 중이라, 이 파일 지역 상수로 둔다.
const SINGLE_CHART_HEIGHT = 350; // 단일 차트 기존 높이(변경 금지)
const PANEL_TARGET_CHART_HEIGHT = 260; // 패널 한 칸의 목표 차트 높이(px)
const PANEL_TITLE_SPACE = 26; // 패널 제목 한 줄 높이(PanelGrid와 동일)
const PANEL_ROW_GAP = 20; // 패널 행 간격(PanelGrid와 동일)

/**
 * 다중 패널 차트에 넘길 전체 height(px)를 패널 수에 비례해 계산한다.
 *
 * 왜 PanelGrid의 행/열 규칙을 그대로 따라야 하나?
 * → PanelGrid는 (전체 height)를 행(row) 수로 나눠 각 패널 높이를 정한다.
 * → 그래서 여기서 "행 수"를 PanelGrid와 동일하게 계산해야,
 *   각 패널이 의도한 목표 높이(약 260px)로 떨어진다.
 *
 * PanelGrid와 맞춘 규칙(반드시 동일하게 유지):
 * → 열 수: 패널 3개 이상 + (이중축 콤보 패널 없음)이면 2열, 아니면 1열.
 * → 행 수: ceil(패널수 / 열수).
 * → 역산: height = rows*(목표높이 + 제목공간) + (rows-1)*행간격.
 *
 * 차트가 아니거나(표/인포그래픽) panels가 없으면 기존 높이(350)를 반환한다.
 * → 표/인포그래픽은 CommonStructure라 panels/chartType이 없으므로 isChartAnalysis로 먼저 좁힌다.
 */
function computeChartHeight(analysis: VisualAnalysis): number {
  // 표·인포그래픽 등 차트가 아닌 콘텐츠는 패널 개념이 없다 → 기존 높이 유지.
  if (!isChartAnalysis(analysis)) return SINGLE_CHART_HEIGHT;

  const panels = analysis.structure.panels;
  const fallbackChartType = analysis.structure.chartType;
  if (!panels || panels.length === 0) return SINGLE_CHART_HEIGHT;

  // PanelGrid와 동일: 이중축(secondaryYAxis) 콤보 패널이 하나라도 있으면 1열(세로 스택).
  const hasWideComboPanel = panels.some(
    (p) => (p.chartType ?? fallbackChartType) === "combo" && !!p.secondaryYAxis,
  );
  const columns = panels.length >= 3 && !hasWideComboPanel ? 2 : 1;
  const rows = Math.ceil(panels.length / columns);

  // 목표 패널 높이로부터 전체 height를 역산(PanelGrid의 분배식을 거꾸로).
  return (
    rows * (PANEL_TARGET_CHART_HEIGHT + PANEL_TITLE_SPACE) +
    (rows - 1) * PANEL_ROW_GAP
  );
}

function buildExportBaseName(index: number, id: string) {
  const safeId = id
    .replace(/[^a-zA-Z0-9_-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();

  return `${String(index + 1).padStart(2, "0")}-${safeId || `chart-${index + 1}`}`;
}

export default function ExportPage() {
  const { isDark, themeMode, toggleTheme } = useThemeMode();
  const { analyses, loading, projects, selectedProject, setSelectedProject } =
    useProjectBrowser();
  const [exporting, setExporting] = useState(false);

  /**
   * chartRefs — 각 차트 DOM 요소를 참조하는 배열
   *
   * useRef란?
   * → React에서 실제 HTML 요소를 "잡아두는" 도구
   * → 여기서는 각 차트 카드의 div를 잡아서
   *   html-to-image에 "이 div를 이미지로 변환해줘"라고 전달
   *
   * Map을 쓰는 이유?
   * → 차트 개수가 동적(5개일 수도, 3개일 수도)이라서
   *   고정 배열 대신 Map으로 index → DOM 매핑
   */
  const chartRefs = useRef<Map<number, HTMLDivElement>>(new Map());

  const projectOptions = projects.map((project) => ({
    value: project.slug,
    label: `${project.date} / ${project.topic} (${project.analysisCount}개)`,
  }));

  /**
   * downloadChart — 개별 차트를 PNG로 다운로드
   *
   * 동작 원리:
   * 1. chartRefs에서 해당 index의 DOM 요소를 가져옴
   * 2. toPng() 함수로 DOM → PNG 데이터(base64) 변환
   * 3. <a> 태그를 만들어서 자동 클릭 → 다운로드 트리거
   */
  async function downloadChart(index: number, baseName: string) {
    const node = chartRefs.current.get(index);
    if (!node) return;

    try {
      const dataUrl = await toPng(node, {
        pixelRatio: chartSettings.export.pixelRatio,
        backgroundColor: node.dataset.exportBg || chartSettings.export.lightBg,
      });

      // 다운로드 트리거: 임시 <a> 태그 생성 → 클릭 → 제거
      const link = document.createElement("a");
      link.download = `${baseName}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error("Export failed:", err);
    }
  }

  /**
   * downloadAll — 모든 차트를 순차적으로 PNG 다운로드
   */
  async function downloadAll() {
    setExporting(true);
    for (let i = 0; i < analyses.length; i++) {
      await downloadChart(i, buildExportBaseName(i, analyses[i].id));
      await new Promise((r) => setTimeout(r, 300));
    }
    setExporting(false);
  }

  return (
    <PageShell
      themeMode={themeMode}
      title="PNG Export"
      description="설명 없이 콘텐츠를 깔끔하게 이미지로 내보내기"
      actions={
        <>
          <ActionButton onClick={toggleTheme} themeMode={themeMode}>
            {isDark ? "☀" : "☾"}
          </ActionButton>
          <ActionButton href="/editor" themeMode={themeMode}>
            부분 수정
          </ActionButton>
          <ActionButton href="/" themeMode={themeMode}>
            ← 돌아가기
          </ActionButton>
        </>
      }
    >
      <ProjectSelectBar
        themeMode={themeMode}
        value={selectedProject}
        options={projectOptions}
        onChange={setSelectedProject}
        trailingContent={
          <ActionButton
            disabled={exporting || analyses.length === 0}
            onClick={downloadAll}
            themeMode={themeMode}
            variant="primary"
            style={{ fontSize: 14, padding: "8px 20px" }}
          >
            {exporting ? "내보내는 중..." : `모두 다운로드 (${analyses.length}개 PNG)`}
          </ActionButton>
        }
      />

      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        {loading ? (
          <StatusPanel themeMode={themeMode}>
            <span style={{ fontSize: 14 }}>로딩 중...</span>
          </StatusPanel>
        ) : (
          analyses.map((analysis, i) => {
            const { headMessage, subMessage, metaMessage } = getDisplayMessages(analysis);
            const renderThemeMode = getAnalysisThemeMode(analysis, themeMode);
            const renderTheme = getTheme(renderThemeMode);
            const preset = getAnalysisStylePreset(analysis);
            const presetColors = getPresetColors(preset, renderThemeMode);
            const exportOptions = (analysis as { exportOptions?: ExportOptions }).exportOptions ?? {};
            const presetExport = preset.export;
            const exportBg = presetColors.background;
            const exportBorder = presetColors.border;
            const exportTypography = renderTheme.typography;
            return (
              <div key={analysis.id}>
              {/* 캡처 대상 영역 — 이 div가 PNG로 변환됨 */}
              <div
                data-export-name={buildExportBaseName(i, analysis.id)}
                data-export-bg={exportBg}
                ref={(el) => {
                  if (el) {
                    chartRefs.current.set(i, el);
                    return;
                  }

                  chartRefs.current.delete(i);
                }}
                style={{
                  background: exportBg,
                  borderRadius: exportOptions.sourceReplica ? 0 : presetExport.borderRadius,
                  border: exportOptions.sourceReplica ? "0" : `${preset.card.borderWidth}px solid ${exportBorder}`,
                  boxShadow: exportOptions.sourceReplica ? "none" : preset.card.shadow,
                  overflow: "hidden",
                }}
              >
                {/* 제목만 간단히 */}
                {!exportOptions.hideHeader && (
                  <div style={{ padding: exportOptions.headerPadding ?? presetExport.headerPadding }}>
                    <h2
                      style={{
                        color: presetColors.textPrimary,
                        fontSize: exportOptions.titleFontSize ?? presetExport.titleFontSize,
                        fontWeight: preset.typography.titleWeight,
                        fontFamily: exportOptions.fontFamily ?? preset.typography.fontFamily ?? exportTypography.fontFamily.sans,
                        letterSpacing: preset.typography.titleLetterSpacing,
                        margin: 0,
                        lineHeight: 1.3,
                      }}
                    >
                      {headMessage}
                    </h2>
                    {subMessage && (
                      <p
                        style={{
                          color: presetColors.textSecondary,
                          fontSize: exportOptions.subtitleFontSize ?? presetExport.subtitleFontSize,
                          fontFamily: exportOptions.fontFamily ?? preset.typography.fontFamily ?? exportTypography.fontFamily.sans,
                          margin: "6px 0 0",
                          lineHeight: 1.45,
                          fontWeight: preset.typography.subtitleWeight,
                        }}
                      >
                        {subMessage}
                      </p>
                    )}
                    {metaMessage && (
                      <p
                        style={{
                          color: presetColors.textTertiary,
                          fontSize: exportOptions.sourceFontSize ?? presetExport.sourceFontSize,
                          fontFamily: exportOptions.fontFamily ?? preset.typography.fontFamily ?? exportTypography.fontFamily.sans,
                          margin: "8px 0 0",
                          lineHeight: 1.4,
                          fontWeight: 500,
                        }}
                      >
                        {metaMessage}
                      </p>
                    )}
                  </div>
                )}

                {/* 차트 (ChartRouter에서 showInsights=false) */}
                <div style={{ padding: exportOptions.contentPadding ?? presetExport.contentPadding }}>
                  <ContentRouter
                    analysis={analysis}
                    theme={renderThemeMode}
                    showInsights={false}
                    showHeader={false}
                    // 다중 패널 차트는 패널 수에 비례해 height를 키운다(D3).
                    // → exportOptions.chartHeight가 명시되면 그것을 최우선 존중,
                    //   없으면 computeChartHeight가 단일=350 / 다중=패널수 비례로 산출.
                    height={
                      exportOptions.chartHeight ?? computeChartHeight(analysis)
                    }
                  />
                </div>

                {/* 출처 (작게) */}
                {analysis.structure.source && !exportOptions.hideSource && (
                  <div style={{ padding: exportOptions.sourcePadding ?? presetExport.sourcePadding }}>
                    <span
                      style={{
                        color: presetColors.textTertiary,
                        fontSize: exportOptions.sourceFontSize ?? presetExport.sourceFontSize,
                        fontFamily: exportOptions.fontFamily ?? preset.typography.fontFamily ?? exportTypography.fontFamily.sans,
                      }}
                    >
                      {analysis.structure.source}
                    </span>
                  </div>
                )}
              </div>

              {/* 개별 다운로드 버튼 — chartSettings에서 켜고 끌 수 있음 */}
              {chartSettings.export.showPngButton && (
                <ActionButton
                  onClick={() => downloadChart(i, buildExportBaseName(i, analysis.id))}
                  themeMode={themeMode}
                  style={{ marginTop: 8, fontSize: 12, padding: "6px 14px" }}
                >
                  PNG 다운로드
                </ActionButton>
              )}
              </div>
            );
          })
        )}
      </div>
    </PageShell>
  );
}
