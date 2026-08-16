#!/usr/bin/env node

/**
 * =====================================================
 * audit-projects.mjs — slide_maker 프로젝트 통합 감사 스크립트
 * =====================================================
 *
 * 왜 만들었나?
 * --------------------------------------------------
 * 이 프로젝트는 차트/표 이미지를 JSON으로 분석해서 PNG 카드로 내보낸다.
 * 프로젝트가 수십 개로 늘어나면서 "어디가 규칙에 어긋났는지"를
 * 사람이 일일이 확인하기 어려워졌다.
 * 이 스크립트는 모든 프로젝트를 한 번에 훑어서 문제를 "보이게" 만든다.
 *
 * 무엇을 검사하나? (검사 7종)
 * --------------------------------------------------
 *  1) 짝 맞춤   : 데이터 폴더(src/data/{slug})와 작업 폴더(projects/{slug})가 둘 다 있는지
 *  2) slug 규칙 : 폴더명이 영문 ASCII인지 (한글 slug 금지 — import/스크립트가 깨질 수 있음)
 *  3) meta 존재 : projects/{slug}/project.meta.json 이 있는지
 *  4) fidelity  : 각 JSON에 preserveIntent.dataFidelity 가 있는지 (정확값/근사값 추적)
 *  5) QA 존재   : source-visible/directional 근사 그래프인데 QA 문서가 없는지
 *  6) 스키마    : chartType / tableSubType / infographicSubType 이 유효 목록에 있는지
 *  7) JSON 파싱 : JSON 파일이 깨지지 않고 정상적으로 읽히는지
 *
 * 심각도(severity) 구분
 * --------------------------------------------------
 *  ✗ FAIL : 실제로 깨지는 문제 (JSON 파싱 실패, 스키마에 없는 타입, 데이터/작업 폴더 짝 안 맞음)
 *  ⚠ WARN : 위생 문제 (meta 누락, fidelity 누락, QA 누락, 한글 slug)
 *
 * 사용법
 * --------------------------------------------------
 *   cd output/chart-app && npm run audit-projects               # 전체 감사
 *   npm run audit-projects -- --slug 2026-05-30-st-page15-end   # 특정 프로젝트만
 *   npm run audit-projects -- --json                            # 기계용 JSON 출력
 *   npm run audit-projects -- --strict                          # 경고(WARN)도 실패로 처리
 *
 * 종료 코드(exit code)
 * --------------------------------------------------
 *   0 = 통과 (FAIL 없음. --strict면 WARN도 없어야 함)
 *   1 = 실패 (FAIL 있음. --strict면 WARN도 실패로 봄)
 *   → CI(자동 검사)나 커밋 전 훅에서 이 코드로 통과/실패를 판단할 수 있다.
 */

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

// --------------------------------------------------
// 경로 설정
// 이 스크립트는 output/chart-app/scripts/ 안에 있다.
// 거기서 한 단계 위가 chart-app, 두 단계 위가 silde_maker 루트다.
// --------------------------------------------------
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CHART_APP_ROOT = path.resolve(__dirname, ".."); // output/chart-app
const REPO_ROOT = path.resolve(CHART_APP_ROOT, "..", ".."); // silde_maker
const DATA_DIR = path.resolve(CHART_APP_ROOT, "src", "data"); // 분석 JSON
const PROJECTS_DIR = path.resolve(REPO_ROOT, "projects"); // 입력/출력 작업 폴더

// --------------------------------------------------
// 스키마에서 가져온 "유효한 타입 목록"
// schema.ts 가 바뀌면 여기도 같이 맞춰야 한다. (검사 6번에서 사용)
// --------------------------------------------------
const VALID_CHART_TYPES = new Set([
  "line", "bar", "bar_horizontal", "stacked_bar", "area", "donut", "pie",
  "candle", "scatter", "combo", "waterfall", "treemap", "heatmap", "radar",
  "funnel", "bubble",
]);
const VALID_TABLE_SUBTYPES = new Set([
  "comparison", "ranking", "summary", "schedule", "financial", "matrix",
]);
const VALID_INFOGRAPHIC_SUBTYPES = new Set([
  "kpi_card", "process_flow", "comparison_card", "timeline", "stat_matrix",
  "feature_list", "news_brief",
]);
const APPROXIMATE_FIDELITY = new Set(["source-visible", "directional"]);

// --------------------------------------------------
// 커맨드라인 옵션 파싱
// --------------------------------------------------
const args = process.argv.slice(2);
const options = {
  slug: null, // --slug XXX : 특정 프로젝트만
  json: args.includes("--json"), // --json : 기계용 출력
  strict: args.includes("--strict"), // --strict : WARN도 실패로
};
const slugIndex = args.indexOf("--slug");
if (slugIndex !== -1 && args[slugIndex + 1]) {
  options.slug = args[slugIndex + 1];
}

// --------------------------------------------------
// 작은 도우미 함수들
// --------------------------------------------------

/** 폴더 안의 하위 폴더 이름만 배열로 반환 (없으면 빈 배열) */
function listDirs(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);
}

/** 문자열이 영문 ASCII만으로 되어 있는지 (한글/특수문자 감지용) */
function isAsciiSlug(slug) {
  // 모든 글자의 코드포인트가 127 이하(=ASCII 범위)면 영문 slug로 본다.
  // 한글 같은 비ASCII 문자는 코드포인트가 127을 넘으므로 false가 된다.
  return [...slug].every((ch) => ch.codePointAt(0) <= 127);
}

/** JSON 파일을 읽어 객체로 반환. 깨지면 { __error } 형태로 알려줌 */
function readJsonSafe(filePath) {
  try {
    return { ok: true, value: JSON.parse(fs.readFileSync(filePath, "utf8")) };
  } catch (error) {
    return { ok: false, error: error.message };
  }
}

/**
 * 분석 JSON 하나가 어떤 콘텐츠인지 판별하고, 타입이 유효한지 검사.
 * contentType 없음 → 차트 / "table" → 표 / "infographic" → 인포그래픽
 * 반환: { kind, typeValue, valid } — valid=false면 스키마에 없는 타입
 */
function classifyAnalysis(analysis) {
  const contentType = analysis.contentType;

  if (contentType === "table") {
    const subType = analysis.tableSubType;
    return {
      kind: "table",
      typeValue: subType ?? "(없음)",
      valid: subType == null || VALID_TABLE_SUBTYPES.has(subType),
    };
  }

  if (contentType === "infographic") {
    const subType = analysis.infographicData?.subType;
    return {
      kind: "infographic",
      typeValue: subType ?? "(없음)",
      valid: subType == null || VALID_INFOGRAPHIC_SUBTYPES.has(subType),
    };
  }

  // contentType이 없으면 일반 차트로 본다
  const chartType = analysis.structure?.chartType ?? analysis.structure?.type;
  return {
    kind: "chart",
    typeValue: chartType ?? "(없음)",
    valid: chartType == null || VALID_CHART_TYPES.has(chartType),
  };
}

// --------------------------------------------------
// 본격 감사 시작
// --------------------------------------------------

// 데이터 폴더와 작업 폴더의 slug 목록을 모은다
const dataSlugs = listDirs(DATA_DIR);
const projectSlugs = listDirs(PROJECTS_DIR);
const allSlugs = [...new Set([...dataSlugs, ...projectSlugs])].sort();

// --slug 옵션이 있으면 그것만 검사
const targetSlugs = options.slug ? [options.slug] : allSlugs;

// 프로젝트별 감사 결과를 담을 배열
const reports = [];

for (const slug of targetSlugs) {
  const hasData = dataSlugs.includes(slug);
  const hasProject = projectSlugs.includes(slug);

  // 이 프로젝트의 문제들을 모은다 ({ severity, code, message })
  const issues = [];

  // [검사 1] 데이터/작업 폴더 짝 맞춤
  if (hasData && !hasProject) {
    issues.push({ severity: "FAIL", code: "PAIR", message: "src/data 에는 있는데 projects 작업 폴더가 없음" });
  }
  if (!hasData && hasProject) {
    issues.push({ severity: "WARN", code: "PAIR", message: "projects 작업 폴더는 있는데 분석 JSON(src/data)이 없음" });
  }

  // [검사 2] slug 영문 규칙
  if (!isAsciiSlug(slug)) {
    issues.push({ severity: "WARN", code: "SLUG", message: "slug에 영문이 아닌 문자(한글 등) 포함 — 영문 ASCII로 변환 권장" });
  }

  // [검사 3] project.meta.json 존재
  const metaPath = path.join(PROJECTS_DIR, slug, "project.meta.json");
  let meta = null;
  if (hasProject) {
    if (!fs.existsSync(metaPath)) {
      issues.push({ severity: "WARN", code: "META", message: "project.meta.json 누락 (topic/slug/createdAt 메타정보 없음)" });
    } else {
      const metaRead = readJsonSafe(metaPath);
      if (!metaRead.ok) {
        issues.push({ severity: "FAIL", code: "META", message: `project.meta.json 파싱 실패: ${metaRead.error}` });
      } else {
        meta = metaRead.value;
        // 보너스 검사: meta 안의 slug가 폴더명과 다르면 경고
        if (meta.slug && meta.slug !== slug) {
          issues.push({ severity: "WARN", code: "META", message: `meta.slug(${meta.slug})가 폴더명(${slug})과 불일치` });
        }
      }
    }
  }

  // 이 프로젝트의 JSON 파일들을 검사
  const dataPath = path.join(DATA_DIR, slug);
  const jsonFiles = hasData
    ? fs.readdirSync(dataPath).filter((name) => name.endsWith(".json")).sort()
    : [];

  let jsonCount = 0;
  let fidelityMissing = 0;
  let needsSourceQa = false;

  for (const fileName of jsonFiles) {
    jsonCount += 1;
    const filePath = path.join(dataPath, fileName);
    const read = readJsonSafe(filePath);

    // [검사 7] JSON 파싱
    if (!read.ok) {
      issues.push({ severity: "FAIL", code: "JSON", message: `${fileName}: JSON 파싱 실패 — ${read.error}` });
      continue;
    }
    const analysis = read.value;

    // [검사 6] 스키마 유효성 (타입이 목록에 있는지)
    const { kind, typeValue, valid } = classifyAnalysis(analysis);
    if (!valid) {
      issues.push({ severity: "FAIL", code: "SCHEMA", message: `${fileName}: 스키마에 없는 ${kind} 타입 "${typeValue}"` });
    }

    // [검사 4] dataFidelity 존재
    const fidelity = analysis.preserveIntent?.dataFidelity;
    if (!fidelity) {
      fidelityMissing += 1;
    } else if (APPROXIMATE_FIDELITY.has(fidelity)) {
      needsSourceQa = true;
    }
  }

  // fidelity 누락은 파일 단위로 시끄러우니 프로젝트 단위로 1줄 요약
  if (fidelityMissing > 0) {
    issues.push({
      severity: "WARN",
      code: "FIDELITY",
      message: `${fidelityMissing}/${jsonCount}개 JSON에 preserveIntent.dataFidelity 누락`,
    });
  }

  // [검사 5] 근사 그래프인데 QA 문서 없음
  if (needsSourceQa) {
    const qaPath = path.join(PROJECTS_DIR, slug, "qa", "source-fidelity-check.md");
    if (!fs.existsSync(qaPath)) {
      issues.push({ severity: "FAIL", code: "QA", message: "source-visible/directional 그래프인데 qa/source-fidelity-check.md 없음" });
    }
  }

  reports.push({ slug, hasData, hasProject, jsonCount, hasMeta: meta != null, issues });
}

// --------------------------------------------------
// 결과 집계
// --------------------------------------------------
const totals = {
  projects: reports.length,
  jsonFiles: reports.reduce((sum, r) => sum + r.jsonCount, 0),
  clean: reports.filter((r) => r.issues.length === 0).length,
  fail: reports.filter((r) => r.issues.some((i) => i.severity === "FAIL")).length,
  warn: reports.filter((r) => r.issues.every((i) => i.severity !== "FAIL") && r.issues.length > 0).length,
};

// 문제 종류(code)별 개수 — 어떤 문제가 가장 많은지 한눈에
const byCode = {};
for (const r of reports) {
  for (const issue of r.issues) {
    const key = `${issue.severity}:${issue.code}`;
    byCode[key] = (byCode[key] ?? 0) + 1;
  }
}

// --------------------------------------------------
// 출력
// --------------------------------------------------
if (options.json) {
  // 기계용: 전체 결과를 JSON 한 덩어리로
  console.log(JSON.stringify({ totals, byCode, reports }, null, 2));
} else {
  // 사람용: 읽기 쉬운 한글 리포트
  console.log("");
  console.log("==================================================");
  console.log("  slide_maker 프로젝트 통합 감사 리포트");
  console.log("==================================================");
  console.log(`  프로젝트 ${totals.projects}개 | JSON ${totals.jsonFiles}개`);
  console.log(`  ✓ 정상 ${totals.clean}  |  ⚠ 경고만 ${totals.warn}  |  ✗ 실패 ${totals.fail}`);
  console.log("--------------------------------------------------");

  // 문제 종류별 요약
  const codeLabels = {
    "FAIL:PAIR": "✗ 데이터/작업 폴더 짝 안 맞음",
    "WARN:PAIR": "⚠ 작업 폴더만 있고 JSON 없음",
    "WARN:SLUG": "⚠ 한글/비ASCII slug",
    "WARN:META": "⚠ meta 누락/불일치",
    "FAIL:META": "✗ meta 파싱 실패",
    "WARN:FIDELITY": "⚠ dataFidelity 누락",
    "FAIL:QA": "✗ 근사 그래프 QA 문서 없음",
    "FAIL:SCHEMA": "✗ 스키마에 없는 타입",
    "FAIL:JSON": "✗ JSON 파싱 실패",
  };
  console.log("  [문제 종류별 집계]");
  const sortedCodes = Object.entries(byCode).sort((a, b) => b[1] - a[1]);
  if (sortedCodes.length === 0) {
    console.log("    (문제 없음 — 모든 프로젝트 깨끗함!)");
  } else {
    for (const [key, count] of sortedCodes) {
      console.log(`    ${codeLabels[key] ?? key} : ${count}건`);
    }
  }
  console.log("--------------------------------------------------");

  // 문제 있는 프로젝트만 상세 출력 (정상 프로젝트는 생략해서 깔끔하게)
  const problematic = reports.filter((r) => r.issues.length > 0);
  if (problematic.length > 0) {
    console.log("  [문제 있는 프로젝트 상세]");
    for (const r of problematic) {
      console.log("");
      console.log(`  ● ${r.slug}`);
      for (const issue of r.issues) {
        const mark = issue.severity === "FAIL" ? "✗" : "⚠";
        console.log(`      ${mark} ${issue.message}`);
      }
    }
    console.log("");
  }
  console.log("==================================================");
}

// --------------------------------------------------
// 종료 코드 결정
// --------------------------------------------------
const hasFail = totals.fail > 0;
const hasWarn = reports.some((r) => r.issues.length > 0);
if (hasFail || (options.strict && hasWarn)) {
  process.exit(1);
}
process.exit(0);
