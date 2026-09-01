import { chromium } from "playwright";
import { existsSync } from "node:fs";
import { writeFile, mkdir } from "node:fs/promises";
import os from "node:os";
const chrome = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const browser = await chromium.launch({
  executablePath:
    process.env.SCANFIT_CHROME ?? (existsSync(chrome) ? chrome : undefined),
});
try {
  const page = await browser.newPage();
  await page.goto(process.env.SCANFIT_URL ?? "http://127.0.0.1:5173");
  const results = await page.evaluate(async () => {
    const corePath = "/packages/scanfit/dist/core.js",
      samplePath = "/playground/samples.ts";
    const loadStart = performance.now();
    const { createScanSession } = await import(/* @vite-ignore */ corePath);
    const coldModuleLoadMs = performance.now() - loadStart;
    const { createSample } = await import(/* @vite-ignore */ samplePath);
    const sources = await Promise.all(
      [0, 1, 2, 3, 4].map((i) => createSample(i)),
    );
    const captures = [],
      exports = [],
      sessions = [],
      longTasks = [];
    const observer = new PerformanceObserver((list) =>
      longTasks.push(...list.getEntries().map((e) => e.duration)),
    );
    observer.observe({ type: "longtask" });
    let coldCaptureMs;
    const warm = createScanSession();
    try {
      for (let i = 0; i < 31; i++) {
        const start = performance.now();
        const [p] = await warm.addFiles([sources[i % 5]]);
        const ms = performance.now() - start;
        if (i === 0) coldCaptureMs = ms;
        else captures.push(ms);
        warm.removePage(p.id);
      }
      await warm.addFiles(sources);
      await warm.exportPdf({ maxBytes: 2_000_000 });
      for (let i = 0; i < 10; i++) {
        const start = performance.now();
        const r = await warm.exportPdf({ maxBytes: 2_000_000 });
        exports.push(performance.now() - start);
        if (r.status !== "ready" || r.file.size > 2_000_000)
          throw new Error("Benchmark failed size contract");
      }
    } finally {
      warm.dispose();
    }
    for (const count of [1, 5, 20]) {
      const s = createScanSession();
      try {
        const start = performance.now();
        await s.addFiles(
          Array.from({ length: count }, (_, i) => sources[i % 5]),
        );
        const imported = performance.now();
        const r = await s.exportPdf({ maxBytes: 2_000_000 });
        sessions.push({
          pages: count,
          importMs: imported - start,
          exportMs: performance.now() - imported,
          status: r.status,
          bytes: r.status === "ready" ? r.file.size : r.candidateBytes,
        });
      } finally {
        s.dispose();
      }
    }
    await new Promise((r) =>
      requestAnimationFrame(() => requestAnimationFrame(r)),
    );
    longTasks.push(...observer.takeRecords().map((e) => e.duration));
    observer.disconnect();
    const stats = (values) => {
      const sorted = [...values].sort((a, b) => a - b);
      return {
        runs: values.length,
        medianMs: sorted[Math.floor(sorted.length / 2)],
        p95Ms: sorted[Math.ceil(sorted.length * 0.95) - 1],
        rawMs: values,
      };
    };
    return {
      coldModuleLoadMs,
      coldCaptureMs,
      warmCapture: stats(captures),
      warmFivePageExport: stats(exports),
      sessions,
      mainThreadLongTasksMs: longTasks,
      jsHeapUsedBytes: performance.memory?.usedJSHeapSize ?? null,
      userAgent: navigator.userAgent,
    };
  });
  const report = {
    measuredAt: new Date().toISOString(),
    host: {
      platform: os.platform(),
      release: os.release(),
      arch: os.arch(),
      cpu: os.cpus()[0]?.model,
    },
    browser: browser.version(),
    method:
      "Desktop headless smoke benchmark; built package served by local Vite (no transfer compression). 1400×1800 synthetic fixtures, 30 warm imports, 10 warm five-page exports, 2,000,000-byte limit. Not a mobile release benchmark. Native/browser memory is unmeasured; JS heap is not total memory.",
    ...results,
  };
  await mkdir("work", { recursive: true });
  await writeFile(
    "work/benchmark-report.json",
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(JSON.stringify(report, null, 2));
} finally {
  await browser.close();
}
