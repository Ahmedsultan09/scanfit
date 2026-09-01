import { readFile, readdir, mkdir, writeFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { gzipSync, brotliCompressSync, constants } from "node:zlib";

const root = "packages/scanfit/dist";
async function walk(dir) {
  const files = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...(await walk(path)));
    else if (/\.(js|css|wasm)$/.test(path)) files.push(path);
  }
  return files;
}
const files = await Promise.all(
  (await walk(root)).map(async (path) => {
    const data = await readFile(path);
    return {
      path: relative(root, path),
      bytes: data.length,
      gzip: gzipSync(data, { level: 9 }).length,
      brotli: brotliCompressSync(data, {
        params: { [constants.BROTLI_PARAM_QUALITY]: 11 },
      }).length,
    };
  }),
);
const sum = (list) =>
  Object.fromEntries(
    ["bytes", "gzip", "brotli"].map((k) => [
      k,
      list.reduce((n, f) => n + f[k], 0),
    ]),
  );
const triggerJs = sum(files.filter((f) => f.path === "trigger.js"));
const trigger = sum(
  files.filter((f) => f.path === "trigger.js" || f.path === "styles.css"),
);
const workflow = sum(
  files.filter(
    (f) =>
      f.path === "core.js" ||
      f.path === "react.js" ||
      f.path === "styles.css" ||
      f.path.startsWith("chunks/"),
  ),
);
// Conservative: every distributed runtime asset, including standalone adapters also present in the worker.
const all = sum(files);
const report = {
  method:
    "Sum of separately compressed distributed assets. Includes all JS, worker code, any emitted WASM, CSS and optional public entry points. Excludes host React and declaration files. No concatenated-size discount. Trigger budget includes eagerly imported CSS.",
  triggerJs,
  trigger,
  workflow,
  all,
  files,
};
await mkdir("work", { recursive: true });
await writeFile(
  "work/size-report.json",
  JSON.stringify(report, null, 2) + "\n",
);
console.table([
  { metric: "Trigger + eager CSS", ...trigger, targetGzip: 5 * 1024 },
  { metric: "Core + React + CSS", ...workflow, targetGzip: 35 * 1024 },
  { metric: "ALL distributed runtime assets", ...all, targetGzip: 120 * 1024 },
]);
if (
  trigger.gzip > 5 * 1024 ||
  workflow.gzip > 35 * 1024 ||
  all.gzip > 120 * 1024
)
  throw new Error("A release size target was exceeded.");
