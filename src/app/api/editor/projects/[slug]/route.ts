import { NextResponse } from "next/server";
import {
  getProjectAnalysisFiles,
  getProjectTopic,
  parseProjectSlug,
} from "@/lib/project-manager";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const { date, topic: fallbackTopic } = parseProjectSlug(slug);
  const topic = (await getProjectTopic(slug)) || fallbackTopic;
  const files = await getProjectAnalysisFiles(slug);

  return NextResponse.json({
    slug,
    date,
    topic,
    files,
  });
}
