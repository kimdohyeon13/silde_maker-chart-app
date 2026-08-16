export function parseExportArgs(args) {
  const listOnly = args.includes("--list");
  const requestedSlugs = [...new Set(args.filter((value) => !value.startsWith("--")))];

  return { listOnly, requestedSlugs };
}

export function resolveExportTargets(requestedSlugs, projects) {
  if (requestedSlugs.length === 0) {
    const latestReady = projects.find((project) => project.analysisCount > 0);
    if (!latestReady) {
      throw new Error("분석 JSON이 있는 프로젝트가 없습니다.");
    }
    return [latestReady.slug];
  }

  const projectBySlug = new Map(projects.map((project) => [project.slug, project]));
  return requestedSlugs.map((slug) => {
    const project = projectBySlug.get(slug);
    if (!project) {
      throw new Error(`프로젝트 "${slug}" 를 찾을 수 없습니다.`);
    }
    if (project.analysisCount <= 0) {
      throw new Error(`프로젝트 "${slug}" 에 분석 JSON이 없습니다.`);
    }
    return slug;
  });
}
