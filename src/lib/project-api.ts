import type { VisualAnalysis } from "@/lib/analysis/schema";
import type {
  ProjectAnalysesResponse,
  ProjectListItem,
  ProjectListResponse,
} from "@/lib/project-types";

async function parseJsonResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    throw new Error(`API 요청 실패 (${response.status})`);
  }

  return response.json() as Promise<T>;
}

export async function fetchProjects(): Promise<ProjectListItem[]> {
  const response = await fetch("/api/projects");
  const data = await parseJsonResponse<ProjectListResponse>(response);
  return data.projects ?? [];
}

export async function fetchProjectAnalyses(
  slug: string
): Promise<VisualAnalysis[]> {
  const response = await fetch(`/api/projects/${encodeURIComponent(slug)}`);
  const data = await parseJsonResponse<ProjectAnalysesResponse>(response);
  return data.analyses ?? [];
}
