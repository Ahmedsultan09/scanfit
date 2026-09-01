import { readFile, writeFile, copyFile } from "node:fs/promises";
const parts = [
  "# Third-party notices\n\nThe runtime bundles the following MIT-licensed dependencies. Scanic is pinned to its classical detector; its optional ML loader is disabled at build time. No upstream package files are modified.\n",
];
for (const name of ["scanic", "tinypdf"]) {
  const pkg = JSON.parse(
    await readFile(`node_modules/${name}/package.json`, "utf8"),
  );
  parts.push(
    `## ${name} ${pkg.version}\n\n${await readFile(`node_modules/${name}/LICENSE`, "utf8")}\n`,
  );
}
await writeFile(
  "packages/scanfit/THIRD_PARTY_NOTICES.md",
  parts.join("\n").trimEnd() + "\n",
);
await copyFile("LICENSE", "packages/scanfit/LICENSE");
