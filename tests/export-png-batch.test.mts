import assert from "node:assert/strict";
import test from "node:test";

import {
  parseExportArgs,
  resolveExportTargets,
  selectExportCardIndices,
} from "../scripts/export-png-core.mjs";

const projects = [
  { slug: "latest", analysisCount: 2 },
  { slug: "empty", analysisCount: 0 },
  { slug: "older", analysisCount: 1 },
];

test("여러 프로젝트 인자는 순서를 유지하고 중복만 제거한다", () => {
  assert.deepEqual(parseExportArgs(["older", "latest", "older"]), {
    listOnly: false,
    requestedSlugs: ["older", "latest"],
    onlyNames: [],
  });
});

test("목록 옵션은 프로젝트 인자와 분리한다", () => {
  assert.deepEqual(parseExportArgs(["--list"]), {
    listOnly: true,
    requestedSlugs: [],
    onlyNames: [],
  });
});

test("인자가 없으면 분석이 있는 첫 프로젝트를 선택한다", () => {
  assert.deepEqual(resolveExportTargets([], projects), ["latest"]);
});

test("요청한 여러 프로젝트를 입력 순서대로 선택한다", () => {
  assert.deepEqual(resolveExportTargets(["older", "latest"], projects), ["older", "latest"]);
});

test("없는 프로젝트와 빈 프로젝트는 출력 전에 거부한다", () => {
  assert.throws(() => resolveExportTargets(["missing"], projects), /찾을 수 없습니다/);
  assert.throws(() => resolveExportTargets(["empty"], projects), /분석 JSON이 없습니다/);
});

test("부분 재출력은 PNG 확장자를 제거하고 기존 카드 순서와 번호를 유지한다", () => {
  const { requestedSlugs, onlyNames } = parseExportArgs(["older", "--only=03-c.png,01-a"]);
  assert.deepEqual(requestedSlugs, ["older"]);
  assert.deepEqual(selectExportCardIndices(["01-a", "02-b", "03-c"], onlyNames), [0, 2]);
  assert.deepEqual(selectExportCardIndices(["01-a", "02-b"]), [0, 1]);
});

test("빈 선택과 없는 카드명은 조용히 건너뛰지 않는다", () => {
  assert.throws(() => parseExportArgs(["older", "--only="]), /파일명/);
  assert.throws(() => selectExportCardIndices(["01-a"], ["02-b"]), /찾을 수 없습니다/);
});
