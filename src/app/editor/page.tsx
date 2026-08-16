"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ContentRouter } from "@/components/charts";
import type {
  AllowedTransformation,
  ChartAnalysis,
  InfographicAnalysis,
  PreserveIntent,
  StylePresetId,
  TableAnalysis,
  VisualAnalysis,
} from "@/lib/analysis/schema";
import {
  isChartAnalysis,
  isInfographicAnalysis,
  isTableAnalysis,
} from "@/lib/analysis/schema";
import { fetchProjectEditor, saveAnalysisFile } from "@/lib/editor-api";
import { fetchProjects } from "@/lib/project-api";
import type { ProjectAnalysisFileItem, ProjectListItem } from "@/lib/project-types";
import {
  DEFAULT_STYLE_PRESET,
  getAnalysisStylePreset,
  getAnalysisThemeMode,
  getPresetColors,
  getStylePresetOptions,
} from "@/lib/style-presets";
import { getTheme } from "@/lib/theme/toss-theme";

const DEFAULT_ALLOWED_TRANSFORMATIONS: AllowedTransformation[] = [
  "translate-text",
  "simplify-labels",
  "rewrite-title",
  "adjust-colors",
  "adjust-layout",
  "adjust-density",
];

const panelStyle = {
  border: "1px solid #30363D",
  background: "#111820",
  borderRadius: 8,
} as const;

function cloneAnalysis<T extends VisualAnalysis>(analysis: T): T {
  return structuredClone(analysis);
}

function getContentTypeLabel(analysis: VisualAnalysis): string {
  if (isTableAnalysis(analysis)) return "표";
  if (isInfographicAnalysis(analysis)) return "인포그래픽";
  return analysis.structure.chartType;
}

function buildDefaultPreserveIntent(analysis: VisualAnalysis): PreserveIntent {
  return {
    originalMessage: analysis.narrative.headline,
    dataFidelity: "source-visible",
    preservedElements: ["원본 숫자", "비교 관계", "핵심 메시지"],
    changedElements: ["색상", "타이포", "레이아웃", "강조 방식"],
    notes: "의미 보존 리디자인 기준으로 생성됨",
  };
}

function FieldLabel({ children }: { children: string }) {
  return (
    <label
      style={{
        display: "block",
        color: "#9AA8B7",
        fontSize: 12,
        fontWeight: 800,
        marginBottom: 6,
      }}
    >
      {children}
    </label>
  );
}

function TextInput({
  label,
  value,
  onChange,
  multiline = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  multiline?: boolean;
}) {
  const commonStyle = {
    width: "100%",
    border: "1px solid #30363D",
    background: "#0D1117",
    color: "#E6EDF3",
    borderRadius: 6,
    padding: "9px 10px",
    fontSize: 13,
    fontFamily: "inherit",
    outline: "none",
  } as const;

  return (
    <div style={{ marginBottom: 14 }}>
      <FieldLabel>{label}</FieldLabel>
      {multiline ? (
        <textarea
          value={value}
          onChange={(event) => onChange(event.target.value)}
          rows={4}
          style={{ ...commonStyle, resize: "vertical", lineHeight: 1.45 }}
        />
      ) : (
        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          style={commonStyle}
        />
      )}
    </div>
  );
}

function SelectInput({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
}) {
  return (
    <div style={{ marginBottom: 14 }}>
      <FieldLabel>{label}</FieldLabel>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        style={{
          width: "100%",
          border: "1px solid #30363D",
          background: "#0D1117",
          color: "#E6EDF3",
          borderRadius: 6,
          padding: "9px 10px",
          fontSize: 13,
          fontFamily: "inherit",
        }}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export default function EditorPage() {
  const [projects, setProjects] = useState<ProjectListItem[]>([]);
  const [selectedProject, setSelectedProject] = useState("");
  const [files, setFiles] = useState<ProjectAnalysisFileItem[]>([]);
  const [selectedFileName, setSelectedFileName] = useState("");
  const [draft, setDraft] = useState<VisualAnalysis | null>(null);
  const [baseMtimeMs, setBaseMtimeMs] = useState<number | undefined>();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");

  const selectedFile = files.find((file) => file.fileName === selectedFileName);
  const dirty = useMemo(() => {
    if (!draft || !selectedFile) return false;
    return JSON.stringify(draft) !== JSON.stringify(selectedFile.analysis);
  }, [draft, selectedFile]);

  useEffect(() => {
    let cancelled = false;

    async function loadProjects() {
      const nextProjects = await fetchProjects();
      if (cancelled) return;
      setProjects(nextProjects);
      const firstReady = nextProjects.find((project) => project.analysisCount > 0);
      setSelectedProject(firstReady?.slug ?? nextProjects[0]?.slug ?? "");
    }

    void loadProjects().catch((error) => {
      if (!cancelled) {
        setStatusMessage(error instanceof Error ? error.message : String(error));
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!selectedProject) return;
    let cancelled = false;

    async function loadProject() {
      setLoading(true);
      setStatusMessage("");
      try {
        const response = await fetchProjectEditor(selectedProject);
        if (cancelled) return;
        setFiles(response.files);
        const nextSelected = response.files[0];
        setSelectedFileName(nextSelected?.fileName ?? "");
        setDraft(nextSelected ? cloneAnalysis(nextSelected.analysis) : null);
        setBaseMtimeMs(nextSelected?.mtimeMs);
      } catch (error) {
        if (!cancelled) {
          setFiles([]);
          setDraft(null);
          setStatusMessage(error instanceof Error ? error.message : String(error));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadProject();

    return () => {
      cancelled = true;
    };
  }, [selectedProject]);

  useEffect(() => {
    const nextSelectedFile = files.find((file) => file.fileName === selectedFileName);
    if (!nextSelectedFile) return;
    setDraft(cloneAnalysis(nextSelectedFile.analysis));
    setBaseMtimeMs(nextSelectedFile.mtimeMs);
  }, [files, selectedFileName]);

  function updateDraft(mutator: (next: VisualAnalysis) => void) {
    setDraft((current) => {
      if (!current) return current;
      const next = cloneAnalysis(current);
      mutator(next);
      return next;
    });
  }

  function setStylePreset(stylePreset: StylePresetId) {
    updateDraft((next) => {
      next.stylePreset = stylePreset;
      next.preserveIntent ??= buildDefaultPreserveIntent(next);
      next.allowedTransformations ??= DEFAULT_ALLOWED_TRANSFORMATIONS;
      next.qualityChecks ??= [
        { id: "data-fidelity", label: "원본 숫자 보존", status: "pending" },
        { id: "layout-fit", label: "텍스트/축 잘림 없음", status: "pending" },
        { id: "style-fit", label: "프리셋 의도 반영", status: "pending" },
      ];
    });
  }

  function updateTableCell(rowIndex: number, columnKey: string, value: string) {
    updateDraft((next) => {
      if (!isTableAnalysis(next)) return;
      const cell = next.tableData.rows[rowIndex]?.cells[columnKey];
      if (!cell) return;
      cell.displayValue = value;
    });
  }

  async function saveDraft() {
    if (!draft || !selectedProject || !selectedFileName) return;
    setSaving(true);
    setStatusMessage("");

    try {
      const response = await saveAnalysisFile({
        slug: selectedProject,
        fileName: selectedFileName,
        analysis: draft,
        baseMtimeMs,
      });
      setFiles((current) =>
        current.map((file) =>
          file.fileName === selectedFileName
            ? {
                ...file,
                analysis: response.analysis,
                mtimeMs: response.mtimeMs,
              }
            : file
        )
      );
      setDraft(cloneAnalysis(response.analysis));
      setBaseMtimeMs(response.mtimeMs);
      setStatusMessage("저장 완료");
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setSaving(false);
    }
  }

  const stylePreset = draft ? getAnalysisStylePreset(draft) : null;
  const renderThemeMode = draft ? getAnalysisThemeMode(draft, "dark") : "dark";
  const renderTheme = getTheme(renderThemeMode);
  const presetColors = stylePreset
    ? getPresetColors(stylePreset, renderThemeMode)
    : renderTheme.colors;

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#0D1117",
        color: "#E6EDF3",
        padding: 24,
        fontFamily: 'var(--font-noto-sans-kr), "Noto Sans KR", "Apple SD Gothic Neo", ui-sans-serif, system-ui, sans-serif',
      }}
    >
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 16,
          margin: "0 auto 18px",
          maxWidth: 1540,
        }}
      >
        <div>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 900 }}>
            Remake Studio
          </h1>
          <p style={{ margin: "6px 0 0", color: "#9AA8B7", fontSize: 14 }}>
            원본 표·그래프의 본질은 유지하고 스타일만 고급화하는 부분 수정 작업대
          </p>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
          <Link href="/" style={navButtonStyle}>
            미리보기
          </Link>
          <Link href="/export" style={navButtonStyle}>
            PNG Export
          </Link>
          <button
            disabled={!dirty || saving}
            onClick={saveDraft}
            style={{
              ...primaryButtonStyle,
              opacity: !dirty || saving ? 0.55 : 1,
              cursor: !dirty || saving ? "not-allowed" : "pointer",
            }}
          >
            {saving ? "저장 중" : dirty ? "JSON 저장" : "변경 없음"}
          </button>
        </div>
      </header>

      <div
        style={{
          maxWidth: 1540,
          margin: "0 auto",
          display: "grid",
          gridTemplateColumns: "280px minmax(520px, 1fr) 390px",
          gap: 16,
          alignItems: "start",
        }}
      >
        <aside style={{ ...panelStyle, padding: 14 }}>
          <FieldLabel>프로젝트</FieldLabel>
          <select
            value={selectedProject}
            onChange={(event) => setSelectedProject(event.target.value)}
            style={selectStyle}
          >
            {projects.map((project) => (
              <option key={project.slug} value={project.slug}>
                {project.date} / {project.topic} ({project.analysisCount})
              </option>
            ))}
          </select>

          <div style={{ marginTop: 18 }}>
            <FieldLabel>콘텐츠</FieldLabel>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {files.map((file) => (
                <button
                  key={file.fileName}
                  onClick={() => setSelectedFileName(file.fileName)}
                  style={{
                    ...fileButtonStyle,
                    borderColor:
                      file.fileName === selectedFileName ? "#58A6FF" : "#30363D",
                    background:
                      file.fileName === selectedFileName ? "#17263B" : "#0D1117",
                  }}
                >
                  <span style={{ fontWeight: 800 }}>{file.analysis.id}</span>
                  <span style={{ color: "#9AA8B7", fontSize: 11 }}>
                    {getContentTypeLabel(file.analysis)} · {file.fileName}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div style={{ marginTop: 18 }}>
            <FieldLabel>스타일 프리셋</FieldLabel>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {getStylePresetOptions().map((preset) => (
                <button
                  key={preset.id}
                  onClick={() => setStylePreset(preset.id)}
                  disabled={!draft}
                  style={{
                    ...presetButtonStyle,
                    borderColor:
                      (draft?.stylePreset ?? DEFAULT_STYLE_PRESET) === preset.id
                        ? "#58A6FF"
                        : "#30363D",
                  }}
                >
                  <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span
                      style={{
                        width: 10,
                        height: 10,
                        borderRadius: 999,
                        background: getPresetColors(preset, preset.mode === "dark" ? "dark" : "light").accent,
                      }}
                    />
                    <span style={{ fontWeight: 900 }}>{preset.name}</span>
                  </span>
                  <span style={{ color: "#9AA8B7", fontSize: 11, lineHeight: 1.35 }}>
                    {preset.description}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </aside>

        <section
          style={{
            ...panelStyle,
            padding: 16,
            minHeight: 760,
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 12,
              alignItems: "center",
              marginBottom: 14,
            }}
          >
            <div>
              <div style={{ color: "#9AA8B7", fontSize: 12, fontWeight: 800 }}>
                실시간 미리보기
              </div>
              <div style={{ marginTop: 3, fontSize: 14, fontWeight: 900 }}>
                {draft?.structure.title ?? "선택된 콘텐츠 없음"}
              </div>
            </div>
            {stylePreset && (
              <span
                style={{
                  border: `1px solid ${presetColors.border}`,
                  background: presetColors.surface,
                  color: presetColors.textPrimary,
                  borderRadius: 999,
                  padding: "6px 10px",
                  fontSize: 12,
                  fontWeight: 900,
                }}
              >
                {stylePreset.name}
              </span>
            )}
          </div>

          <div
            style={{
              background: presetColors.background,
              border: `1px solid ${presetColors.border}`,
              borderRadius: 8,
              padding: 14,
              overflow: "auto",
            }}
          >
            {loading ? (
              <div style={{ color: "#9AA8B7", padding: 30 }}>로딩 중...</div>
            ) : draft ? (
              <ContentRouter analysis={draft} theme={renderThemeMode} showInsights />
            ) : (
              <div style={{ color: "#9AA8B7", padding: 30 }}>
                편집할 JSON이 없습니다.
              </div>
            )}
          </div>

          {statusMessage && (
            <p style={{ color: statusMessage === "저장 완료" ? "#3FB950" : "#F85149", fontSize: 13 }}>
              {statusMessage}
            </p>
          )}
        </section>

        <aside style={{ ...panelStyle, padding: 14, maxHeight: "calc(100vh - 112px)", overflow: "auto" }}>
          {draft ? (
            <EditorPanel
              draft={draft}
              updateDraft={updateDraft}
              updateTableCell={updateTableCell}
            />
          ) : (
            <div style={{ color: "#9AA8B7", fontSize: 13 }}>
              왼쪽에서 콘텐츠를 선택하세요.
            </div>
          )}
        </aside>
      </div>
    </main>
  );
}

function EditorPanel({
  draft,
  updateDraft,
  updateTableCell,
}: {
  draft: VisualAnalysis;
  updateDraft: (mutator: (next: VisualAnalysis) => void) => void;
  updateTableCell: (rowIndex: number, columnKey: string, value: string) => void;
}) {
  return (
    <>
      <h2 style={{ margin: "0 0 14px", fontSize: 17, fontWeight: 900 }}>
        부분 수정 패널
      </h2>

      <SelectInput
        label="데이터 보존 수준"
        value={draft.preserveIntent?.dataFidelity ?? "source-visible"}
        options={[
          { value: "exact", label: "정확히 보존" },
          { value: "source-visible", label: "원본 화면 기준 보존" },
          { value: "directional", label: "방향성 중심" },
        ]}
        onChange={(value) =>
          updateDraft((next) => {
            next.preserveIntent ??= buildDefaultPreserveIntent(next);
            next.preserveIntent.dataFidelity = value as PreserveIntent["dataFidelity"];
          })
        }
      />

      <TextInput
        label="제목"
        value={draft.structure.title}
        onChange={(value) =>
          updateDraft((next) => {
            next.structure.title = value;
          })
        }
      />

      <TextInput
        label="부제목"
        value={draft.structure.subtitle ?? ""}
        onChange={(value) =>
          updateDraft((next) => {
            next.structure.subtitle = value;
          })
        }
      />

      <TextInput
        label="출처"
        value={draft.structure.source ?? ""}
        onChange={(value) =>
          updateDraft((next) => {
            next.structure.source = value;
          })
        }
      />

      <TextInput
        label="큰 메시지"
        value={draft.narrative.headMessage ?? ""}
        onChange={(value) =>
          updateDraft((next) => {
            next.narrative.headMessage = value;
          })
        }
      />

      <TextInput
        label="보조 메시지"
        value={draft.narrative.subMessage ?? ""}
        onChange={(value) =>
          updateDraft((next) => {
            next.narrative.subMessage = value;
          })
        }
      />

      <TextInput
        label="원본 핵심 메시지"
        multiline
        value={draft.preserveIntent?.originalMessage ?? ""}
        onChange={(value) =>
          updateDraft((next) => {
            next.preserveIntent ??= buildDefaultPreserveIntent(next);
            next.preserveIntent.originalMessage = value;
          })
        }
      />

      <TextInput
        label="포커스 수치/라벨"
        value={draft.emphasis.focusPoint.displayText}
        onChange={(value) =>
          updateDraft((next) => {
            next.emphasis.focusPoint.displayText = value;
          })
        }
      />

      {isTableAnalysis(draft) && (
        <TableEditor
          analysis={draft}
          updateDraft={updateDraft}
          updateTableCell={updateTableCell}
        />
      )}

      {isChartAnalysis(draft) && (
        <ChartEditor analysis={draft} updateDraft={updateDraft} />
      )}

      {isInfographicAnalysis(draft) && (
        <InfographicEditor analysis={draft} updateDraft={updateDraft} />
      )}
    </>
  );
}

function TableEditor({
  analysis,
  updateDraft,
  updateTableCell,
}: {
  analysis: TableAnalysis;
  updateDraft: (mutator: (next: VisualAnalysis) => void) => void;
  updateTableCell: (rowIndex: number, columnKey: string, value: string) => void;
}) {
  return (
    <div style={{ marginTop: 20 }}>
      <h3 style={sectionTitleStyle}>표 수정</h3>

      {analysis.tableData.columns.map((column, columnIndex) => (
        <TextInput
          key={column.key}
          label={`열 ${columnIndex + 1} 라벨`}
          value={column.label}
          onChange={(value) =>
            updateDraft((next) => {
              if (!isTableAnalysis(next)) return;
              next.tableData.columns[columnIndex].label = value;
            })
          }
        />
      ))}

      <div style={{ overflowX: "auto", border: "1px solid #30363D", borderRadius: 6 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 540 }}>
          <thead>
            <tr>
              {analysis.tableData.columns.map((column) => (
                <th key={column.key} style={miniTableHeaderStyle}>
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {analysis.tableData.rows.map((row, rowIndex) => (
              <tr key={rowIndex}>
                {analysis.tableData.columns.map((column) => {
                  const cell = row.cells[column.key];
                  return (
                    <td key={column.key} style={miniTableCellStyle}>
                      <input
                        value={cell?.displayValue ?? String(cell?.value ?? "")}
                        onChange={(event) =>
                          updateTableCell(rowIndex, column.key, event.target.value)
                        }
                        style={miniInputStyle}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ChartEditor({
  analysis,
  updateDraft,
}: {
  analysis: ChartAnalysis;
  updateDraft: (mutator: (next: VisualAnalysis) => void) => void;
}) {
  return (
    <div style={{ marginTop: 20 }}>
      <h3 style={sectionTitleStyle}>그래프 수정</h3>

      {analysis.structure.legend.map((legend, index) => (
        <div key={index} style={{ display: "grid", gridTemplateColumns: "1fr 92px", gap: 8 }}>
          <TextInput
            label={`범례 ${index + 1}`}
            value={legend.name}
            onChange={(value) =>
              updateDraft((next) => {
                if (!isChartAnalysis(next)) return;
                next.structure.legend[index].name = value;
                if (next.data.series[index]) next.data.series[index].name = value;
              })
            }
          />
          <TextInput
            label="색상"
            value={legend.originalColor ?? ""}
            onChange={(value) =>
              updateDraft((next) => {
                if (!isChartAnalysis(next)) return;
                next.structure.legend[index].originalColor = value;
              })
            }
          />
        </div>
      ))}

      {analysis.emphasis.annotations.map((annotation, index) => (
        <TextInput
          key={index}
          label={`어노테이션 ${index + 1}`}
          value={annotation.text}
          onChange={(value) =>
            updateDraft((next) => {
              if (!isChartAnalysis(next)) return;
              next.emphasis.annotations[index].text = value;
            })
          }
        />
      ))}
    </div>
  );
}

function InfographicEditor({
  analysis,
  updateDraft,
}: {
  analysis: InfographicAnalysis;
  updateDraft: (mutator: (next: VisualAnalysis) => void) => void;
}) {
  const data = analysis.infographicData;

  return (
    <div style={{ marginTop: 20 }}>
      <h3 style={sectionTitleStyle}>인포그래픽 수정</h3>
      <p style={{ color: "#9AA8B7", fontSize: 12 }}>
        subtype: {data.subType}
      </p>

      {"items" in data &&
        data.items.map((item, index) => (
          <div key={index} style={{ borderTop: "1px solid #30363D", paddingTop: 12 }}>
            {"label" in item && (
              <TextInput
                label={`항목 ${index + 1} 라벨`}
                value={String(item.label)}
                onChange={(value) =>
                  updateDraft((next) => {
                    if (!isInfographicAnalysis(next)) return;
                    const nextData = next.infographicData;
                    if (!("items" in nextData)) return;
                    const nextItem = nextData.items[index];
                    if (nextItem && "label" in nextItem) {
                      nextItem.label = value;
                    }
                  })
                }
              />
            )}
            {"value" in item && (
              <TextInput
                label={`항목 ${index + 1} 값`}
                value={String(item.value)}
                onChange={(value) =>
                  updateDraft((next) => {
                    if (!isInfographicAnalysis(next)) return;
                    const nextData = next.infographicData;
                    if (!("items" in nextData)) return;
                    const nextItem = nextData.items[index];
                    if (nextItem && "value" in nextItem) {
                      nextItem.value = value;
                    }
                  })
                }
              />
            )}
          </div>
        ))}
    </div>
  );
}

const navButtonStyle = {
  border: "1px solid #30363D",
  background: "#111820",
  color: "#E6EDF3",
  borderRadius: 8,
  padding: "9px 14px",
  fontSize: 13,
  fontWeight: 800,
  textDecoration: "none",
} as const;

const primaryButtonStyle = {
  border: "none",
  background: "#58A6FF",
  color: "#FFFFFF",
  borderRadius: 8,
  padding: "9px 16px",
  fontSize: 13,
  fontWeight: 900,
} as const;

const selectStyle = {
  width: "100%",
  border: "1px solid #30363D",
  background: "#0D1117",
  color: "#E6EDF3",
  borderRadius: 6,
  padding: "9px 10px",
  fontSize: 12,
  fontFamily: "ui-monospace, monospace",
} as const;

const fileButtonStyle = {
  border: "1px solid #30363D",
  color: "#E6EDF3",
  borderRadius: 7,
  padding: 10,
  textAlign: "left",
  display: "flex",
  flexDirection: "column",
  gap: 4,
  cursor: "pointer",
} as const;

const presetButtonStyle = {
  border: "1px solid #30363D",
  background: "#0D1117",
  color: "#E6EDF3",
  borderRadius: 7,
  padding: 10,
  textAlign: "left",
  display: "flex",
  flexDirection: "column",
  gap: 6,
  cursor: "pointer",
} as const;

const sectionTitleStyle = {
  color: "#E6EDF3",
  fontSize: 14,
  fontWeight: 900,
  margin: "4px 0 12px",
} as const;

const miniTableHeaderStyle = {
  color: "#9AA8B7",
  background: "#161B22",
  borderBottom: "1px solid #30363D",
  padding: 6,
  fontSize: 11,
  textAlign: "left",
} as const;

const miniTableCellStyle = {
  borderBottom: "1px solid #21262D",
  padding: 4,
} as const;

const miniInputStyle = {
  width: "100%",
  minWidth: 80,
  border: "1px solid #30363D",
  background: "#0D1117",
  color: "#E6EDF3",
  borderRadius: 4,
  padding: "5px 6px",
  fontSize: 12,
} as const;
