import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";

const packageManifest = JSON.parse(
  await readFile("packages/scanfit/package.json", "utf8"),
);
const lock = JSON.parse(await readFile("package-lock.json", "utf8"));
if (packageManifest.dependencies?.scanic)
  throw new Error("Scanic remains a runtime dependency.");
if (lock.packages?.["node_modules/scanic"])
  throw new Error("Scanic remains in the reproducible dependency tree.");

async function runtimeFiles(directory) {
  const output = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) output.push(...(await runtimeFiles(path)));
    else if (/\.(?:js|wasm)$/.test(path)) output.push(path);
  }
  return output;
}

for (const path of await runtimeFiles("packages/scanfit/dist")) {
  const contents = await readFile(path, "utf8");
  if (/scanic(?:-ml|\/|\b)/i.test(contents))
    throw new Error(`Scanic code or a loader reference leaked into ${path}.`);
}

console.log(
  "Independent detector check passed: no Scanic manifest, lockfile, or emitted-runtime coupling.",
);
