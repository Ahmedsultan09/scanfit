import { describe, expect, it } from "vitest";
import { createScanSession } from "../../packages/scanfit/src/core";
describe("SSR-safe session lifecycle", () => {
  it("can import and construct without window, camera, workers or DOM", () => {
    const s = createScanSession();
    expect(s.getSnapshot().pages).toEqual([]);
    s.dispose();
  });
  it("provides a stable snapshot between changes", () => {
    const s = createScanSession();
    expect(s.getSnapshot()).toBe(s.getSnapshot());
    s.dispose();
  });
  it("notifies subscriptions and removes them", () => {
    const s = createScanSession();
    let count = 0;
    const unsubscribe = s.subscribe(() => count++);
    s.cancel();
    expect(count).toBe(1);
    unsubscribe();
    s.cancel();
    expect(count).toBe(1);
    s.dispose();
  });
  it("rejects invalid limits", () =>
    expect(() => createScanSession({ limits: { maxPixels: 0 } })).toThrow());
  it("disposes idempotently and rejects future operations", async () => {
    const s = createScanSession();
    s.dispose();
    s.dispose();
    expect(() => s.cancel()).toThrow("disposed");
    await expect(s.addFiles([new Blob(["x"])])).rejects.toMatchObject({
      code: "DISPOSED",
    });
  });
  it("does not allow empty exports", async () => {
    const s = createScanSession();
    await expect(s.exportPdf({ maxBytes: 1000 })).rejects.toThrow(
      "at least one page",
    );
    s.dispose();
  });
});
