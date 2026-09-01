import { build } from "vite";
import webpack from "webpack";
import { resolve, join, extname } from "node:path";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { createServer } from "node:http";
import { chromium } from "playwright";

await build({
  configFile: false,
  root: resolve("tests/consumers"),
  base: "./",
  build: {
    outDir: resolve("dist/consumer-vite"),
    emptyOutDir: true,
    minify: true,
  },
});
await new Promise((ok, fail) =>
  webpack(
    {
      mode: "production",
      experiments: { css: true },
      entry: resolve("tests/consumers/main.js"),
      output: {
        clean: true,
        path: resolve("dist/consumer-webpack"),
        filename: "main.js",
        publicPath: "auto",
      },
      devtool: false,
    },
    (err, stats) =>
      err || stats.hasErrors()
        ? fail(err ?? new Error(stats.toString({ all: false, errors: true })))
        : ok(),
  ),
);
await writeFile(
  "dist/consumer-webpack/index.html",
  (await readFile("tests/consumers/index.html", "utf8")).replace(
    "</head>",
    '<link rel="stylesheet" href="./main.css"></head>',
  ),
);
// SSR must be import-safe without DOM, Worker, File, or camera access.
const { createScanSession } = await import("@scanfit/browser/core");
await import("@scanfit/browser/react");
await import("@scanfit/browser/trigger");
const ssr = createScanSession();
ssr.dispose();
const mime = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".wasm": "application/wasm",
};
const server = createServer(async (req, res) => {
  try {
    let path = decodeURIComponent(new URL(req.url, "http://local").pathname);
    if (path.endsWith("/")) path += "index.html";
    const file = resolve("dist", "." + path);
    if (!file.startsWith(resolve("dist") + "/")) throw Error();
    res.setHeader(
      "Content-Type",
      mime[extname(file)] ?? "application/octet-stream",
    );
    res.end(await readFile(file));
  } catch {
    res.statusCode = 404;
    res.end("Not found");
  }
});
await new Promise((ok) => server.listen(0, "127.0.0.1", ok));
const chrome = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const browser = await chromium.launch({
  executablePath:
    process.env.SCANFIT_CHROME ?? (existsSync(chrome) ? chrome : undefined),
});
const results = [];
try {
  for (const kind of ["vite", "webpack"]) {
    const page = await browser.newPage();
    const errors = [],
      failed = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("response", (r) => {
      if (r.status() >= 400) failed.push(r.url());
    });
    await page.goto(
      `http://127.0.0.1:${server.address().port}/consumer-${kind}/`,
    );
    const result = await page.evaluate(() => window.runScanFitFixture());
    await page.getByRole("button", { name: "Open scanner" }).click();
    await page.getByRole("dialog").waitFor();
    const css = await page
      .locator(".sf-scanner")
      .evaluate((el) => getComputedStyle(el).getPropertyValue("--sf-accent"));
    if (
      result.status !== "ready" ||
      result.bytes > 100_000 ||
      errors.length ||
      failed.length ||
      !css.trim()
    )
      throw new Error(JSON.stringify({ kind, result, errors, failed, css }));
    results.push({
      kind,
      ...result,
      errors,
      failed,
      cssLoaded: Boolean(css.trim()),
    });
    await page.close();
  }
  await mkdir("work", { recursive: true });
  await writeFile(
    "work/consumer-report.json",
    JSON.stringify({ browser: browser.version(), results }, null, 2) + "\n",
  );
  console.log(JSON.stringify(results, null, 2));
} finally {
  await browser.close();
  await new Promise((ok) => server.close(ok));
}
