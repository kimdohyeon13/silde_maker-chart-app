import { NextResponse } from "next/server";
import type { SaveAnalysisRequest } from "@/lib/project-types";
import { saveProjectAnalysisFile } from "@/lib/project-manager";

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function validateVisualAnalysis(value: unknown): string | null {
  if (!isObject(value)) {
    return "analysis는 객체여야 합니다.";
  }

  if (typeof value.id !== "string" || !value.id.trim()) {
    return "analysis.id는 필수 문자열입니다.";
  }

  if (!isObject(value.structure) || typeof value.structure.title !== "string") {
    return "analysis.structure.title은 필수 문자열입니다.";
  }

  if (!isObject(value.narrative) || typeof value.narrative.headline !== "string") {
    return "analysis.narrative.headline은 필수 문자열입니다.";
  }

  if (!isObject(value.emphasis)) {
    return "analysis.emphasis는 필수 객체입니다.";
  }

  return null;
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ slug: string; fileName: string }> }
) {
  try {
    const { slug, fileName } = await params;
    const body = (await request.json()) as SaveAnalysisRequest;
    const validationError = validateVisualAnalysis(body.analysis);

    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    const saved = await saveProjectAnalysisFile(
      slug,
      fileName,
      body.analysis,
      body.baseMtimeMs
    );

    return NextResponse.json({
      success: true,
      fileName: saved.fileName,
      mtimeMs: saved.mtimeMs,
      analysis: saved.analysis,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 409 }
    );
  }
}
