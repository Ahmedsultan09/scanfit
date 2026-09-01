import { test, expect } from "@playwright/test";
import { mkdir } from "node:fs/promises";

test("three photos → edit → inspect encoded pixels → explicit confirmation → PDF download", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page.getByRole("button", { name: "Try with sample documents" }).click();
  await expect(
    page.getByRole("button", { name: "Page 3", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Page 3", exact: true }).click();
  await page.getByRole("button", { name: "Nudge right", exact: true }).click();
  await page.getByRole("button", { name: "Rotate clockwise" }).click();
  await page.getByRole("button", { name: "Move page earlier" }).click();
  await page.getByRole("button", { name: "Prepare PDF", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Ready for your final look." }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Download PDF" })).toHaveCount(
    0,
  );
  await page.getByLabel("Preview zoom").selectOption("200");
  await page.getByRole("button", { name: "Use this PDF" }).click();
  const downloaded = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download PDF" }).click();
  const download = await downloaded;
  await mkdir("work", { recursive: true });
  await download.saveAs("work/browser-export.pdf");
  expect(errors).toEqual([]);
  await page.screenshot({ path: "work/workflow.png", fullPage: true });
});

test("real worker export, exact-byte boundary, PDF.js rendering, metadata and no document network", async ({
  page,
}) => {
  await page.goto("/");
  const requests: { url: string; method: string }[] = [];
  page.on("request", (r) =>
    requests.push({ url: r.url(), method: r.method() }),
  );
  const result = await page.evaluate(async () => {
    const path = "/tests/browser/harness.ts";
    const { createScanSession, createSample, validatePdf } = await import(
      /* @vite-ignore */ path
    );
    const session = createScanSession();
    try {
      const added = await session.addFiles([
        await createSample(0),
        await createSample(1),
      ]);
      const prepared = await session.exportPdf({ maxBytes: 2_000_000 });
      if (prepared.status !== "ready") throw new Error("Sample did not fit");
      const pdf = await validatePdf(
        new Uint8Array(await prepared.file.arrayBuffer()),
      );
      const size = prepared.file.size,
        boundary = await session.exportPdf({ maxBytes: size });
      const text = await prepared.file.text();
      const finalPixelBytes =
        await prepared.report.pages[0].preview.arrayBuffer();
      const hasExif = async (blob: Blob) => {
        const bytes = new Uint8Array(await blob.arrayBuffer());
        for (let i = 2; i + 9 < bytes.length && bytes[i] === 0xff; ) {
          const marker = bytes[i + 1];
          if (marker === 0xda || marker === 0xd9) break;
          const length = (bytes[i + 2] << 8) | bytes[i + 3];
          if (length < 2 || i + length + 2 > bytes.length) break;
          if (
            marker === 0xe1 &&
            bytes[i + 4] === 0x45 &&
            bytes[i + 5] === 0x78 &&
            bytes[i + 6] === 0x69 &&
            bytes[i + 7] === 0x66 &&
            bytes[i + 8] === 0 &&
            bytes[i + 9] === 0
          )
            return true;
          i += length + 2;
        }
        return false;
      };
      return {
        size,
        boundary: boundary.status,
        boundaryBytes: boundary.status === "ready" ? boundary.file.size : 0,
        pages: pdf.pages,
        warnings: added.map((p: any) => p.warnings),
        metadata: pdf.metadata,
        privateName: text.includes("sample-"),
        hasExif: (
          await Promise.all(prepared.report.pages.map((p: any) => hasExif(p.preview)))
        ).some(Boolean),
        previewBytes: finalPixelBytes.byteLength,
        localStorage: localStorage.length,
        sessionStorage: sessionStorage.length,
      };
    } finally {
      session.dispose();
    }
  });
  expect(result.size).toBeLessThanOrEqual(2_000_000);
  expect(result.boundary).toBe("ready");
  expect(result.boundaryBytes).toBe(result.size);
  expect(result.pages).toHaveLength(2);
  expect(result.pages.every((p: any) => p.ink > 1000)).toBe(true);
  expect(result.warnings.flat()).not.toContain("detection-unavailable");
  expect(result.privateName).toBe(false);
  expect(result.hasExif).toBe(false);
  expect(result.localStorage + result.sessionStorage).toBe(0);
  expect(
    requests.every(
      (r) => {
        const url = new URL(r.url);
        return (
          (url.protocol === "blob:" || url.origin === "http://127.0.0.1:5173") &&
          r.method === "GET"
        );
      },
    ),
  ).toBe(true);
});

test("impossible limit preserves pages; editing invalidates output; cancellation and replacement are safe", async ({
  page,
}) => {
  await page.goto("/");
  const result = await page.evaluate(async () => {
    const path = "/tests/browser/harness.ts";
    const { createScanSession, coloredImage } = await import(
      /* @vite-ignore */ path
    );
    const session = createScanSession({
      detector: "none",
      limits: { maxPages: 2 },
    });
    try {
      const files = [await coloredImage(), await coloredImage(6)],
        pages = await session.addFiles(files);
      const result = await session.exportPdf({ maxBytes: 1 });
      const kept = session.getSnapshot().pages.length;
      session.updatePage(pages[0].id, { rotation: 90 });
      const invalidated = session.getSnapshot().result === null;
      const abort = new AbortController();
      const pending = session.exportPdf({
        maxBytes: 2_000_000,
        signal: abort.signal,
      });
      abort.abort();
      const cancelled = await pending;
      let rejected = false;
      try {
        await session.addFiles([new Blob(["bad"])], {
          replacePageId: pages[0].id,
        });
      } catch {
        rejected = true;
      }
      const originalPreserved =
        session.getSnapshot().pages[0].id === pages[0].id &&
        session.getSnapshot().pages[0].edits.rotation === 90;
      await session.addFiles([files[1]], { replacePageId: pages[0].id });
      const replaced =
        session.getSnapshot().pages.length === 2 &&
        session.getSnapshot().pages[0].edits.rotation === 0;
      session.movePage(pages[0].id, 1);
      session.removePage(pages[1].id);
      const retry = await session.exportPdf({ maxBytes: 2_000_000 });
      return {
        status: result.status,
        kept,
        invalidated,
        cancelled: cancelled.status,
        rejected,
        originalPreserved,
        replaced,
        retry: retry.status,
        attempts: result.report.pages.map((p: any) => p.attempts),
      };
    } finally {
      session.dispose();
    }
  });
  expect(result).toMatchObject({
    status: "cannot-fit",
    kept: 2,
    invalidated: true,
    cancelled: "cancelled",
    rejected: true,
    originalPreserved: true,
    replaced: true,
    retry: "ready",
  });
  expect(result.attempts.every((n: number) => n <= 12)).toBe(true);
});

test("EXIF orientations 1–8 are applied once; transparent pixels export white", async ({
  page,
}) => {
  await page.goto("/");
  const result = await page.evaluate(async () => {
    const path = "/tests/browser/harness.ts";
    const { createScanSession, coloredImage, pixel } = await import(
      /* @vite-ignore */ path
    );
    const results = [];
    for (let orientation = 1; orientation <= 9; orientation++) {
      const session = createScanSession({ detector: "none" });
      try {
        const source = await coloredImage(orientation, orientation === 9);
        const [p] = await session.addFiles([source]);
        const r = await session.exportPdf({ maxBytes: 100_000 });
        if (r.status !== "ready") throw new Error("No JPEG");
        results.push({
          width: p.width,
          height: p.height,
          pixel: await pixel(r.report.pages[0].preview),
        });
      } finally {
        session.dispose();
      }
    }
    return results;
  });
  const colors = [
    [255, 0, 0],
    [0, 255, 0],
    [255, 255, 0],
    [0, 0, 255],
    [255, 0, 0],
    [0, 0, 255],
    [255, 255, 0],
    [0, 255, 0],
    [255, 255, 255],
  ];
  result.forEach((r: any, i: number) => {
    expect(r.width).toBe(i >= 4 && i < 8 ? 100 : 160);
    expect(r.height).toBe(i >= 4 && i < 8 ? 160 : 100);
    colors[i].forEach((v, j) =>
      expect(Math.abs(r.pixel[j] - v)).toBeLessThan(12),
    );
  });
});

test("RTL mobile layout, keyboard/tap crop editing, dialog focus and denied camera", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByLabel("RTL layout").check();
  await page.getByRole("button", { name: "Try with sample documents" }).click();
  await expect(
    page.getByRole("button", { name: "Page 3", exact: true }),
  ).toBeVisible();
  const corner = page.getByRole("button", {
    name: "Corner: Top left",
    exact: true,
  });
  await corner.focus();
  const before = await corner.getAttribute("style");
  await corner.press("Shift+ArrowRight");
  await expect(corner).not.toHaveAttribute("style", before!);
  await page.getByRole("button", { name: "Nudge down", exact: true }).click();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({ path: "work/mobile-rtl.png", fullPage: true });
  const trigger = page.getByRole("button", {
    name: "Try the lazy-loaded dialog",
  });
  await trigger.click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Use camera" })
    .click();
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText(
    "camera",
  );
  await page.getByRole("button", { name: "Close scanner" }).click();
  await expect(trigger).toBeFocused();
});

test("canvas bridge fallback and a high-resolution source crop retain native detail", async ({
  page,
}) => {
  await page.goto("/");
  const r = await page.evaluate(async () => {
    const path = "/tests/browser/harness.ts";
    const { createScanSession, coloredImage, pixel } = await import(
      /* @vite-ignore */ path
    );
    const fallback = createScanSession({
      workerUrl: "/tests/browser/fallback.worker.ts",
    });
    let fallbackPixel, warnings;
    try {
      const [p] = await fallback.addFiles([await coloredImage(6)]);
      warnings = p.warnings;
      const r = await fallback.exportPdf({ maxBytes: 100_000 });
      fallbackPixel = await pixel(r.report.pages[0].preview);
    } finally {
      fallback.dispose();
    }
    const c = document.createElement("canvas");
    c.width = c.height = 5000;
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, 5000, 5000);
    ctx.fillStyle = "black";
    ctx.fillRect(1750, 1750, 50, 1500);
    const blob = await new Promise<Blob>((resolve) =>
      c.toBlob((b) => resolve(b!), "image/png"),
    );
    c.width = c.height = 0;
    const s = createScanSession({ detector: "none" });
    try {
      const [p] = await s.addFiles([blob]);
      s.updatePage(p.id, {
        corners: [
          { x: 0.3, y: 0.3 },
          { x: 0.7, y: 0.3 },
          { x: 0.7, y: 0.7 },
          { x: 0.3, y: 0.7 },
        ],
      });
      const result = await s.exportPdf({ maxBytes: 1_000_000 });
      return {
        fallbackPixel,
        warnings,
        width: result.report.pages[0].width,
        height: result.report.pages[0].height,
      };
    } finally {
      s.dispose();
    }
  });
  expect(r.warnings).toContain("detection-unavailable");
  expect(r.fallbackPixel[2]).toBeGreaterThan(240);
  expect(r.width).toBeGreaterThanOrEqual(1998);
  expect(r.height).toBeGreaterThanOrEqual(1998);
});

test("disposing queued jobs cannot resurrect a worker", async ({ page }) => {
  await page.addInitScript(() => {
    const Original = Worker;
    const counts = { created: 0, active: 0 };
    (window as any).workerCounts = counts;
    window.Worker = class extends Original {
      private stopped = false;
      constructor(url: string | URL, options?: WorkerOptions) {
        super(url, options);
        counts.created++;
        counts.active++;
      }
      terminate() {
        if (!this.stopped) {
          this.stopped = true;
          counts.active--;
        }
        super.terminate();
      }
    };
  });
  await page.goto("/");
  const result = await page.evaluate(async () => {
    const path = "/tests/browser/harness.ts";
    const { createScanSession, coloredImage } = await import(
      /* @vite-ignore */ path
    );
    const s = createScanSession({ detector: "none" });
    const [p] = await s.addFiles([await coloredImage()]);
    const queued = Array.from({ length: 5 }, () => s.renderPage(p.id));
    s.dispose();
    const settled = await Promise.allSettled(queued);
    return {
      rejected: settled.every((r) => r.status === "rejected"),
      counts: (window as any).workerCounts,
    };
  });
  expect(result.rejected).toBe(true);
  expect(result.counts.active).toBe(0);
  expect(result.counts.created).toBe(1);
});

test("manual camera shutter, hidden tabs and closing stop all tracks", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const counts = { started: 0, stopped: 0 };
    (window as any).cameraCounts = counts;
    const sources = new WeakMap<HTMLMediaElement, unknown>();
    Object.defineProperty(HTMLMediaElement.prototype, "srcObject", {
      configurable: true,
      get() {
        return sources.get(this) ?? null;
      },
      set(value) {
        sources.set(this, value);
      },
    });
    Object.defineProperties(HTMLVideoElement.prototype, {
      videoWidth: { configurable: true, get: () => 320 },
      videoHeight: { configurable: true, get: () => 480 },
    });
    HTMLMediaElement.prototype.play = async () => {};
    const drawImage = CanvasRenderingContext2D.prototype.drawImage;
    CanvasRenderingContext2D.prototype.drawImage = function (...args: any[]) {
      if (args[0] instanceof HTMLVideoElement) {
        this.fillStyle = "white";
        this.fillRect(0, 0, 320, 480);
        return;
      }
      return drawImage.apply(this, args as any);
    };
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: {
        getUserMedia: async () => {
        counts.started++;
        let stopped = false;
        return {
          getTracks: () => [
            {
              stop: () => {
                if (stopped) return;
                stopped = true;
                counts.stopped++;
              },
            },
          ],
        } as unknown as MediaStream;
        },
      },
    });
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Use camera", exact: true }).click();
  await expect(page.getByRole("button", { name: "Take photo" })).toBeEnabled();
  await page.getByRole("button", { name: "Take photo" }).click();
  await expect(
    page.getByRole("button", { name: "Page 1", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Use camera", exact: true }).click();
  await expect(page.getByRole("button", { name: "Take photo" })).toBeEnabled();
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", {
      configurable: true,
      value: true,
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect(page.getByRole("button", { name: "Take photo" })).toHaveCount(0);
  const counts = await page.evaluate(() => (window as any).cameraCounts);
  expect(counts.started).toBeGreaterThanOrEqual(2);
  expect(counts.stopped).toBe(counts.started); // StrictMode also exercises mount/cleanup replay.
});
