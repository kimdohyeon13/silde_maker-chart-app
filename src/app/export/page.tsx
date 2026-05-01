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
import { ContentRouter } from "@/components/charts";
import { getDisplayMessages } from "@/lib/analysis/message-agent";
import { useProjectBrowser } from "@/hooks/use-project-browser";
import { useThemeMode } from "@/hooks/use-theme-mode";
import { chartSettings } from "@/lib/chart-settings";
import { getTheme } from "@/lib/theme/toss-theme";

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
  const theme = getTheme(themeMode);
  const { colors, typography } = theme;

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

  // 내보내기 설정에서 배경색/테두리 가져오기
  const exportBg = isDark
    ? chartSettings.export.darkBg
    : chartSettings.export.lightBg;
  const exportBorder = isDark
    ? chartSettings.export.darkBorder
    : chartSettings.export.lightBorder;
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
        backgroundColor: exportBg,
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

            return (
              <div key={analysis.id}>
              {/* 캡처 대상 영역 — 이 div가 PNG로 변환됨 */}
              <div
                data-export-name={buildExportBaseName(i, analysis.id)}
                ref={(el) => {
                  if (el) {
                    chartRefs.current.set(i, el);
                    return;
                  }

                  chartRefs.current.delete(i);
                }}
                style={{
                  background: exportBg,
                  borderRadius: chartSettings.export.borderRadius,
                  border: `1px solid ${exportBorder}`,
                  overflow: "hidden",
                }}
              >
                {/* 제목만 간단히 */}
                <div style={{ padding: chartSettings.export.headerPadding }}>
                  <h2
                    style={{
                      color: colors.textPrimary,
                      fontSize: chartSettings.export.titleFontSize,
                      fontWeight: 700,
                      letterSpacing: "-0.03em",
                      margin: 0,
                      lineHeight: 1.3,
                    }}
                  >
                    {headMessage}
                  </h2>
                  {subMessage && (
                    <p
                      style={{
                        color: colors.textSecondary,
                        fontSize: chartSettings.export.subtitleFontSize,
                        margin: "6px 0 0",
                        lineHeight: 1.45,
                        fontWeight: 600,
                      }}
                    >
                      {subMessage}
                    </p>
                  )}
                  {metaMessage && (
                    <p
                      style={{
                        color: colors.textTertiary,
                        fontSize: chartSettings.export.sourceFontSize,
                        margin: "8px 0 0",
                        lineHeight: 1.4,
                        fontWeight: 500,
                      }}
                    >
                      {metaMessage}
                    </p>
                  )}
                </div>

                {/* 차트 (ChartRouter에서 showInsights=false) */}
                <div style={{ padding: chartSettings.export.contentPadding }}>
                  <ContentRouter
                    analysis={analysis}
                    theme={themeMode}
                    showInsights={false}
                    showHeader={false}
                  />
                </div>

                {/* 출처 (작게) */}
                {analysis.structure.source && (
                  <div style={{ padding: chartSettings.export.sourcePadding }}>
                    <span
                      style={{
                        color: colors.textTertiary,
                        fontSize: chartSettings.export.sourceFontSize,
                        fontFamily: typography.fontFamily.sans,
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
