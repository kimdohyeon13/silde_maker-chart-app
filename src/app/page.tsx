/**
 * =====================================================
 * 메인 페이지 — 프로젝트 선택 + 차트 렌더링
 * =====================================================
 *
 * 변경사항:
 * → 프로젝트 목록/분석 데이터 로딩 로직을 공용 훅으로 분리
 * → 테마 전환 로직도 공용 훅으로 분리
 * → 페이지는 "화면을 어떻게 보여줄지"에만 집중
 */

"use client";

import ActionButton from "@/components/app/ActionButton";
import PageShell from "@/components/app/PageShell";
import ProjectSelectBar from "@/components/app/ProjectSelectBar";
import StatusPanel from "@/components/app/StatusPanel";
import { ContentRouter } from "@/components/charts";
import { useProjectBrowser } from "@/hooks/use-project-browser";
import { useThemeMode } from "@/hooks/use-theme-mode";
import { allDemoData } from "@/lib/demo-data";
import { getTheme } from "@/lib/theme/toss-theme";

export default function Home() {
  const { isDark, themeMode, toggleTheme } = useThemeMode();
  const {
    analyses,
    currentProject,
    demoProjectSlug,
    loading,
    projects,
    selectedProject,
    setSelectedProject,
  } = useProjectBrowser({ demoAnalyses: allDemoData });
  const theme = getTheme(themeMode);
  const { colors, typography } = theme;

  const selectedProjectLabel =
    currentProject?.slug || selectedProject || "프로젝트-slug";
  const projectOptions = [
    { value: demoProjectSlug, label: "데모 데이터 (샘플)" },
    ...projects.map((project) => ({
      value: project.slug,
      label: `${project.date} / ${project.topic}${
        project.analysisCount > 0
          ? ` (${project.analysisCount}개 콘텐츠)`
          : " (분석 대기)"
      }`,
    })),
  ];

  return (
    <PageShell
      themeMode={themeMode}
      title="Chart Remake"
      description="차트·표·뉴스 기사를 토스증권 스타일 콘텐츠로 리메이크"
      actions={
        <>
          <ActionButton href="/export" themeMode={themeMode} variant="primary">
            PNG 내보내기
          </ActionButton>
          <ActionButton onClick={toggleTheme} themeMode={themeMode}>
            {isDark ? "☀ 라이트 모드" : "☾ 다크 모드"}
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
          currentProject ? (
            <span
              style={{
                fontSize: 12,
                color: colors.accent,
                fontFamily: typography.fontFamily.mono,
                whiteSpace: "nowrap",
              }}
            >
              {currentProject.imageCount} img / {currentProject.analysisCount} json
            </span>
          ) : null
        }
      />

      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        {loading ? (
          <StatusPanel themeMode={themeMode}>
            <span style={{ fontSize: 14 }}>프로젝트 데이터 로딩 중...</span>
          </StatusPanel>
        ) : analyses.length > 0 ? (
          analyses.map((analysis) => (
            <ContentRouter
              key={analysis.id}
              analysis={analysis}
              theme={themeMode}
              showInsights={true}
            />
          ))
        ) : (
          <StatusPanel dashed themeMode={themeMode}>
            <p style={{ fontSize: 16, fontWeight: 600, margin: "0 0 8px" }}>
              분석 데이터가 없습니다
            </p>
            <p style={{ fontSize: 13, margin: 0 }}>
              projects/{selectedProjectLabel}/input 폴더에 이미지나 기사 스크린샷을 넣고
              <br />
              <code
                style={{
                  background: colors.surface,
                  padding: "2px 6px",
                  borderRadius: 4,
                  fontSize: 12,
                  color: colors.textPrimary,
                }}
              >
                /chart-remake
              </code>{" "}
              명령어를 실행하세요
            </p>
          </StatusPanel>
        )}
      </div>

      <footer
        style={{
          marginTop: 48,
          paddingTop: 24,
          borderTop: `1px solid ${colors.borderSubtle}`,
          textAlign: "center",
        }}
      >
        <p
          style={{
            fontSize: 12,
            color: colors.textTertiary,
            margin: 0,
          }}
        >
          Claude Code 리메이크 엔진 · projects/.../input에 이미지를 넣고 /chart-remake 실행
        </p>
      </footer>
    </PageShell>
  );
}
