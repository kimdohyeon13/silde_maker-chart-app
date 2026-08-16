import { realpath } from "node:fs/promises";
import { isAbsolute, relative, resolve, sep } from "node:path";

/**
 * 후보 경로가 지정한 루트와 같거나 그 하위에 있는지 확인한다.
 *
 * 단순한 `startsWith` 비교는 `/project/demo-evil`도 `/project/demo` 안으로
 * 오인한다. `relative` 결과가 상위 경로인지 확인하면 경로 구분자까지
 * 포함한 실제 경계를 기준으로 판정할 수 있다.
 */
export function isPathWithin(rootPath: string, candidatePath: string): boolean {
  const root = resolve(rootPath);
  const candidate = resolve(candidatePath);
  const relativePath = relative(root, candidate);

  return (
    relativePath === "" ||
    (relativePath !== ".." &&
      !relativePath.startsWith(`..${sep}`) &&
      !isAbsolute(relativePath))
  );
}

/** 루트 밖으로 나가지 않는 경우에만 결합된 절대 경로를 반환한다. */
export function resolvePathWithin(
  rootPath: string,
  ...pathSegments: string[]
): string | null {
  const root = resolve(rootPath);
  const candidate = resolve(root, ...pathSegments);

  return isPathWithin(root, candidate) ? candidate : null;
}

/**
 * 존재하는 파일의 실제 경로까지 확인한다.
 * 심볼릭 링크가 루트 밖 파일을 가리키는 경우에는 null을 반환한다.
 */
export async function resolveExistingPathWithin(
  rootPath: string,
  ...pathSegments: string[]
): Promise<string | null> {
  const candidate = resolvePathWithin(rootPath, ...pathSegments);
  if (!candidate) {
    return null;
  }

  try {
    const [realRoot, realCandidate] = await Promise.all([
      realpath(rootPath),
      realpath(candidate),
    ]);

    return isPathWithin(realRoot, realCandidate) ? realCandidate : null;
  } catch {
    return null;
  }
}
