/**
 * =====================================================
 * 프로젝트 매니저 — 프로젝트별 폴더 관리
 * =====================================================
 *
 * 역할:
 * → 차트 리메이크 작업을 "프로젝트" 단위로 관리
 * → 각 프로젝트는 yyyy-mm-dd-topic 형식의 폴더를 가짐
 * → input, data, exports 3곳에 동일한 이름의 폴더 생성
 *
 * 왜 프로젝트 단위로 관리하나?
 * → 여러 번 차트 리메이크를 하다 보면 파일이 섞임
 * → "지난주 반도체 분석"과 "이번 주 환율 분석"을 구분하기 위해
 * → 날짜 + 주제로 폴더를 만들면 정리가 깔끔
 *
 * 폴더 구조 예시:
 * silde_maker/
 * ├── projects/2026-03-24-semiconductor/input/  ← 이미지 넣는 곳
 * ├── projects/2026-03-24-semiconductor/output/ ← PNG 결과물
 * └── output/chart-app/src/data/2026-03-24-semiconductor/ ← 분석 JSON
 */

import { readdir, mkdir, readFile, stat, writeFile } from "fs/promises";
import { join } from "path";
import type {
  CreateProjectResult,
  ProjectInfo,
  ProjectListItem,
  ProjectMetadata,
} from "@/lib/project-types";
import type { VisualAnalysis } from "@/lib/analysis/schema";

// ─────────────────────────────────────────────
// 경로 설정
// ─────────────────────────────────────────────

/**
 * 프로젝트 루트 경로들
 *
 * process.cwd()란?
 * → 현재 프로세스의 "작업 디렉토리" (= package.json이 있는 곳)
 * → Next.js에서는 항상 프로젝트 루트를 반환
 *
 * 왜 __dirname 대신 process.cwd()를 쓰나?
 * → Turbopack으로 빌드하면 __dirname이 .next/server/ 안으로 바뀜
 * → 그러면 상대 경로 계산이 전부 틀어짐!
 * → process.cwd()는 항상 chart-app/ 폴더를 가리키므로 안전
 *
 * path.join이란?
 * → 경로 조각들을 OS에 맞게 합쳐주는 함수
 * → Windows는 \, Mac/Linux는 / 를 사용하는데 join이 알아서 처리
 */
const CHART_APP_ROOT = process.cwd();
const SILDE_MAKER_ROOT = join(CHART_APP_ROOT, "..", "..");
const PROJECTS_ROOT = join(SILDE_MAKER_ROOT, "projects");
const DATA_ROOT = join(CHART_APP_ROOT, "src", "data");
const PROJECT_SLUG_PATTERN = /^(\d{4}-\d{2}-\d{2})-(.+)$/;
const IMAGE_FILE_PATTERN = /\.(png|jpg|jpeg|webp|gif)$/i;
const PROJECT_META_FILE = "project.meta.json";
const PROJECT_META_VERSION = 2;
const HANGUL_BASE = 0xac00;
const HANGUL_LAST = 0xd7a3;
const CHOSEONG = [
  "g", "kk", "n", "d", "tt", "r", "m", "b", "pp", "s",
  "ss", "", "j", "jj", "ch", "k", "t", "p", "h",
];
const JUNGSEONG = [
  "a", "ae", "ya", "yae", "eo", "e", "yeo", "ye", "o", "wa",
  "wae", "oe", "yo", "u", "wo", "we", "wi", "yu", "eu", "ui", "i",
];
const JONGSEONG = [
  "", "k", "k", "ks", "n", "nj", "nh", "t", "l", "lk",
  "lm", "lb", "ls", "lt", "lp", "lh", "m", "p", "ps", "t",
  "t", "ng", "t", "t", "k", "t", "p", "h",
];

// ─────────────────────────────────────────────
// 핵심 함수들
// ─────────────────────────────────────────────

/**
 * slugify — 주제 이름을 폴더명에 안전한 형태로 변환
 *
 * 왜 필요한가?
 * → 폴더 이름에는 특수문자, 공백, 한글이 문제될 수 있음
 * → "반도체 수출 분석!" → "bandoche-suchul-bunseok" 같은
 *   영문 ASCII 형태로 바꿔야 링크/미리보기가 안정적
 *
 * 공백 → 하이픈, 한글 → 대략적 로마자, 특수문자 제거
 */
function romanizeHangulChar(char: string): string | null {
  const code = char.codePointAt(0);
  if (code == null || code < HANGUL_BASE || code > HANGUL_LAST) {
    return null;
  }

  const syllableIndex = code - HANGUL_BASE;
  const choseongIndex = Math.floor(syllableIndex / 588);
  const jungseongIndex = Math.floor((syllableIndex % 588) / 28);
  const jongseongIndex = syllableIndex % 28;

  return `${CHOSEONG[choseongIndex]}${JUNGSEONG[jungseongIndex]}${JONGSEONG[jongseongIndex]}`;
}

function slugify(text: string): string {
  const normalized = Array.from(text.trim().normalize("NFC"))
    .map((char) => {
      const romanized = romanizeHangulChar(char);
      if (romanized) {
        return romanized;
      }

      if (/[a-zA-Z0-9]/.test(char)) {
        return char.toLowerCase();
      }

      if (/[\s/_-]/.test(char)) {
        return "-";
      }

      return "";
    })
    .join("");

  return normalized.replace(/-+/g, "-").replace(/^-|-$/g, "");
}

function buildProjectPaths(slug: string) {
  const root = join(PROJECTS_ROOT, slug);
  return {
    root,
    input: join(root, "input"),
    data: join(DATA_ROOT, slug),
    exports: join(root, "output"),
    meta: join(root, PROJECT_META_FILE),
  };
}

function splitProjectSlug(slug: string): { date: string; topic: string } {
  const match = slug.match(PROJECT_SLUG_PATTERN);
  if (match) {
    return { date: match[1], topic: match[2] };
  }

  return { date: "", topic: slug };
}

function isImageFile(fileName: string): boolean {
  return IMAGE_FILE_PATTERN.test(fileName);
}

async function readProjectMetadata(slug: string): Promise<ProjectMetadata | null> {
  try {
    const { meta } = buildProjectPaths(slug);
    const content = await readFile(meta, "utf-8");
    return JSON.parse(content) as ProjectMetadata;
  } catch {
    return null;
  }
}

/**
 * generateSlug — 프로젝트 슬러그(폴더 이름) 생성
 *
 * 슬러그(slug)란?
 * → URL이나 파일명에 쓸 수 있는 짧은 식별자
 * → 블로그 URL에서 "my-first-post" 같은 게 슬러그
 *
 * @param topic - 주제 (예: "반도체 수출")
 * @param date - 날짜 (기본값: 오늘)
 * @returns "2026-03-24-bandoche-suchul"
 */
export function generateSlug(topic: string, date?: Date): string {
  const d = date || new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");

  const safeTopic = slugify(topic) || "project";
  return `${yyyy}-${mm}-${dd}-${safeTopic}`;
}

/**
 * createProject — 새 프로젝트 폴더 3개 동시 생성
 *
 * mkdir의 { recursive: true } 옵션이란?
 * → 중간 경로 폴더가 없으면 자동으로 만들어줌
 * → 예: projects/ 폴더가 없어도 projects/2026-03-24-xxx/input 를 한 번에 생성
 * → 이미 폴더가 있으면 에러 없이 넘어감
 *
 * Promise.all이란?
 * → 여러 비동기 작업을 "동시에" 실행
 * → 3개 폴더를 하나씩 만들면 느리지만, 동시에 만들면 빠름
 *
 * @param topic - 주제 (예: "반도체 수출 분석")
 * @param date - 날짜 (기본값: 오늘)
 */
export async function createProject(
  topic: string,
  date?: Date
): Promise<CreateProjectResult> {
  const slug = generateSlug(topic, date);
  const paths = buildProjectPaths(slug);

  try {
    // 3개 폴더를 동시에 생성 (병렬!)
    await Promise.all([
      mkdir(paths.root, { recursive: true }),
      mkdir(paths.input, { recursive: true }),
      mkdir(paths.data, { recursive: true }),
      mkdir(paths.exports, { recursive: true }),
    ]);

    const metadata: ProjectMetadata = {
      topic,
      slug,
      createdAt: new Date().toISOString(),
      slugVersion: PROJECT_META_VERSION,
    };

    await writeFile(paths.meta, `${JSON.stringify(metadata, null, 2)}\n`, "utf-8");

    return { success: true, slug, paths };
  } catch (error) {
    return {
      success: false,
      slug,
      paths,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * listProjects — 존재하는 모든 프로젝트 목록 조회
 *
 * 동작 원리:
 * 1. data/ 폴더의 하위 디렉토리를 스캔
 * 2. yyyy-mm-dd 패턴으로 시작하는 폴더만 필터링
 * 3. 각 폴더의 이미지 수, 분석 JSON 수를 카운트
 * 4. 날짜 기준 내림차순 정렬 (최신이 위)
 *
 * 왜 data/ 기준으로 스캔하나?
 * → data/ 에 JSON이 있어야 실제로 볼 수 있는 프로젝트
 * → input/ 에만 이미지가 있고 분석 안 된 건 아직 미완성
 */
export async function listProjects(): Promise<ProjectInfo[]> {
  try {
    // data/ 폴더 존재 확인, 없으면 빈 배열 반환
    await stat(DATA_ROOT);
  } catch {
    return [];
  }

  try {
    const entries = await readdir(DATA_ROOT, { withFileTypes: true });

    /**
     * Dirent란?
     * → readdir의 결과로 나오는 "디렉토리 엔트리" 객체
     * → .isDirectory() 로 폴더인지, .isFile() 로 파일인지 구분 가능
     * → 이름은 .name 으로 접근
     */
    const projectDirs = entries.filter(
      (entry) =>
        entry.isDirectory() &&
        // yyyy-mm-dd 패턴으로 시작하는지 체크
        PROJECT_SLUG_PATTERN.test(entry.name)
    );

    // 각 프로젝트 정보를 병렬로 수집
    const results = await Promise.all(
      projectDirs.map(async (dir) => {
        const slug = dir.name;
        const { date, topic: fallbackTopic } = splitProjectSlug(slug);
        const paths = buildProjectPaths(slug);
        const metadata = await readProjectMetadata(slug);
        const topic = metadata?.topic ?? fallbackTopic;

        // 이미지 수 카운트 (input 폴더)
        let imageCount = 0;
        try {
          const inputFiles = await readdir(paths.input);
          imageCount = inputFiles.filter(isImageFile).length;
        } catch {
          // input 폴더가 없을 수 있음
        }

        // 분석 JSON 수 카운트 (data 폴더)
        let analysisCount = 0;
        try {
          const dataFiles = await readdir(paths.data);
          analysisCount = dataFiles.filter((f) => f.endsWith(".json")).length;
        } catch {
          // data 폴더가 없을 수 있음
        }

        return {
          slug,
          date,
          topic,
          imageCount,
          analysisCount,
          paths,
        };
      })
    );

    // 날짜 기준 내림차순 정렬 (최신이 맨 위)
    results.sort((a, b) => b.date.localeCompare(a.date));

    return results;
  } catch {
    return [];
  }
}

/**
 * getProjectAnalyses — 특정 프로젝트의 모든 분석 JSON을 로드
 *
 * @param slug - 프로젝트 슬러그 (예: "2026-03-24-semiconductor")
 * @returns 분석 결과 배열 (ChartAnalysis[])
 */
export async function getProjectAnalyses(slug: string): Promise<VisualAnalysis[]> {
  const projectDataDir = join(DATA_ROOT, slug);

  try {
    const files = await readdir(projectDataDir);
    const jsonFiles = files.filter((f) => f.endsWith(".json")).sort();

    // 모든 JSON 파일을 병렬로 읽기
    const analyses = await Promise.all(
      jsonFiles.map(async (file) => {
        const content = await readFile(join(projectDataDir, file), "utf-8");
        return JSON.parse(content);
      })
    );

    return analyses;
  } catch {
    return [];
  }
}

/**
 * parseProjectSlug — 슬러그에서 날짜와 주제를 분리
 *
 * @param slug - "2026-03-24-semiconductor"
 * @returns { date: "2026-03-24", topic: "semiconductor" }
 */
export function parseProjectSlug(slug: string): {
  date: string;
  topic: string;
} {
  return splitProjectSlug(slug);
}

export async function getProjectTopic(slug: string): Promise<string> {
  const metadata = await readProjectMetadata(slug);
  if (metadata?.topic) {
    return metadata.topic;
  }

  return splitProjectSlug(slug).topic;
}

export function toProjectListItem(project: ProjectInfo): ProjectListItem {
  return {
    slug: project.slug,
    date: project.date,
    topic: project.topic,
    imageCount: project.imageCount,
    analysisCount: project.analysisCount,
  };
}

/**
 * 경로 상수 내보내기
 * → 다른 파일에서 이 경로를 사용할 수 있도록
 */
export const PATHS = {
  SILDE_MAKER_ROOT,
  PROJECTS_ROOT,
  DATA_ROOT,
};
