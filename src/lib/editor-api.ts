import type { VisualAnalysis } from "@/lib/analysis/schema";
import type {
  ProjectEditorResponse,
  SaveAnalysisResponse,
} from "@/lib/project-types";

async function parseJsonResponse<T>(response: Response): Promise<T> {
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data?.error ?? `API 요청 실패 (${response.status})`);
  }

  return data as T;
}

export async function fetchProjectEditor(
  slug: string
): Promise<ProjectEditorResponse> {
  const response = await fetch(`/api/editor/projects/${encodeURIComponent(slug)}`);
  return parseJsonResponse<ProjectEditorResponse>(response);
}

export async function saveAnalysisFile(params: {
  slug: string;
  fileName: string;
  analysis: VisualAnalysis;
  baseMtimeMs?: number;
}): Promise<SaveAnalysisResponse> {
  const response = await fetch(
    `/api/editor/projects/${encodeURIComponent(params.slug)}/analyses/${encodeURIComponent(params.fileName)}`,
    {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        analysis: params.analysis,
        baseMtimeMs: params.baseMtimeMs,
      }),
    }
  );

  return parseJsonResponse<SaveAnalysisResponse>(response);
}
