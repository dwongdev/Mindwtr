import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { parse } from "yaml";

test("beta repository package versions preserve the prerelease tilde", () => {
  const workflow = parse(readFileSync(".github/workflows/publish-repo.yml", "utf8"));
  const normalizeStep = workflow.jobs["build-repo"].steps.find(
    (step) => step.name === "Normalize prerelease package versions"
  );

  expect(normalizeStep).toBeDefined();
  expect(normalizeStep.run).toContain('PKG_VERSION="${VERSION/-/\\~}"');
});
