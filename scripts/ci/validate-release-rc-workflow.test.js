import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { parse } from "yaml";

test("RC tag pushes publish Android builds to Play internal and open testing", () => {
  const workflow = parse(readFileSync(".github/workflows/release-rc.yml", "utf8"));
  const playTrack = workflow.jobs.android.with.play_track;

  expect(playTrack).toContain("'internal,beta'");
});

test("RC workflow dispatch defaults include Play open testing", () => {
  const workflow = parse(readFileSync(".github/workflows/release-rc.yml", "utf8"));

  expect(workflow.on.workflow_dispatch.inputs.play_track.default).toBe("beta");
});

test("RC Android Play and FOSS builds share a parallel versionCode preflight", () => {
  const workflow = parse(readFileSync(".github/workflows/release-rc.yml", "utf8"));

  expect(workflow.jobs["android-version-code"]).toBeDefined();
  expect(workflow.jobs.android.needs).toEqual(["validate", "android-version-code"]);
  expect(workflow.jobs.android.with.version_code).toBe("${{ needs['android-version-code'].outputs.version_code }}");
  expect(workflow.jobs["android-foss"].needs).toEqual(["validate", "android-version-code"]);
  expect(workflow.jobs["android-foss"].with.version_code).toBe("${{ needs['android-version-code'].outputs.version_code }}");
});

test("RC validation checks the committed FOSS version before platform builds start", () => {
  const workflow = parse(readFileSync(".github/workflows/release-rc.yml", "utf8"));
  const steps = workflow.jobs.validate.steps;
  const versionCheckIndex = steps.findIndex(
    (step) => step.name === "Verify committed FOSS release version matches the RC tag"
  );
  const tagCommitCheckIndex = steps.findIndex(
    (step) => step.name === "Verify RC tag points at this commit"
  );

  expect(versionCheckIndex).toBeGreaterThan(-1);
  expect(steps[versionCheckIndex].run).toContain("apps/mobile/release-version.json");
  expect(steps[versionCheckIndex].run).toContain("./scripts/bump-version.sh");
  expect(versionCheckIndex).toBeLessThan(tagCommitCheckIndex);
});
