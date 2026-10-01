export function parseExportArgs(args) {
  const listOnly = args.includes("--list");
  const requestedSlugs = [...new Set(args.filter((value) => !value.startsWith("--")))];

  const onlyNames = [...new Set(args.filter((value) => value.startsWith("--only="))
    .flatMap((value) => value.slice(7).split(","))
    .map((value) => value.trim().replace(/\.png$/i, "")))];
  if (onlyNames.includes("")) throw new Error("--only= 뒤에 출력 파일명을 지정하세요.");
  return { listOnly, requestedSlugs, onlyNames };
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

// 원래 카드 번호와 파일명을 유지한다. 잘못된 파일명은 캡처 전에 거부한다.
export function selectExportCardIndices(exportNames, onlyNames = []) {
  for (const name of onlyNames) {
    if (!exportNames.includes(name)) throw new Error(`출력 카드 "${name}" 를 찾을 수 없습니다.`);
  }
  return exportNames.flatMap((name, index) =>
    onlyNames.length === 0 || onlyNames.includes(name) ? [index] : [],
  );
}
