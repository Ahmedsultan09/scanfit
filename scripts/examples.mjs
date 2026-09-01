import { spawnSync } from "node:child_process";

const examples = [
  "@scanfit/example-vite-react",
  "@scanfit/example-next",
  "@scanfit/example-vanilla",
  "@scanfit/example-vue",
  "@scanfit/example-svelte",
];

for (const workspace of examples) {
  const result = spawnSync(
    process.platform === "win32" ? "npm.cmd" : "npm",
    ["run", "build", "--workspace", workspace],
    { stdio: "inherit" },
  );
  if (result.status !== 0) process.exit(result.status ?? 1);
}
