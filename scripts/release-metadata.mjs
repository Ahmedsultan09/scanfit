import { appendFileSync, readFileSync } from "node:fs";

const packageJson = JSON.parse(
  readFileSync(new URL("../packages/scanfit/package.json", import.meta.url), "utf8"),
);
const expectedTag = `v${packageJson.version}`;
const releaseTag = process.env.SCANFIT_RELEASE_TAG;

if (releaseTag !== expectedTag) {
  throw new Error(
    `GitHub release tag ${JSON.stringify(releaseTag)} does not match ${expectedTag}.`,
  );
}

const distributionTag = packageJson.version.includes("-") ? "next" : "latest";
const output = process.env.GITHUB_OUTPUT;

if (!output) throw new Error("GITHUB_OUTPUT is required.");

appendFileSync(output, `distribution_tag=${distributionTag}\n`, "utf8");
