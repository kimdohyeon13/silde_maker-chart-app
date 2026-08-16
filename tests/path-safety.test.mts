import assert from "node:assert/strict";
import { mkdtemp, mkdir, realpath, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";

import {
  isPathWithin,
  resolveExistingPathWithin,
  resolvePathWithin,
} from "../src/lib/path-safety.ts";

test("경로 경계는 루트와 실제 하위 경로만 허용한다", () => {
  const root = resolve("/tmp/slide-maker/projects/demo");

  assert.equal(isPathWithin(root, root), true);
  assert.equal(isPathWithin(root, join(root, "input", "chart.png")), true);
  assert.equal(isPathWithin(root, resolve(root, "..", "demo-evil", "secret.png")), false);
  assert.equal(isPathWithin(root, resolve(root, "..", "secret.png")), false);
});

test("안전한 경로 결합은 상위 이동과 절대 경로 탈출을 거부한다", () => {
  const root = resolve("/tmp/slide-maker/projects/demo");

  assert.equal(
    resolvePathWithin(root, "input", "chart.png"),
    join(root, "input", "chart.png"),
  );
  assert.equal(resolvePathWithin(root, "..", "demo-evil", "secret.png"), null);
  assert.equal(resolvePathWithin(root, resolve("/tmp/outside.png")), null);
});

test("실제 경로 검증은 심볼릭 링크를 통한 루트 탈출을 거부한다", async () => {
  const sandbox = await mkdtemp(join(tmpdir(), "slide-maker-path-safety-"));
  const root = join(sandbox, "project");
  const outside = join(sandbox, "outside.png");
  const inside = join(root, "inside.png");
  const linkedOutside = join(root, "linked-outside.png");

  try {
    await mkdir(root);
    await writeFile(inside, "inside");
    await writeFile(outside, "outside");
    await symlink(outside, linkedOutside);

    assert.equal(await resolveExistingPathWithin(root, "inside.png"), await realpath(inside));
    assert.equal(await resolveExistingPathWithin(root, "linked-outside.png"), null);
    assert.equal(await resolveExistingPathWithin(root, "missing.png"), null);
  } finally {
    await rm(sandbox, { recursive: true, force: true });
  }
});
