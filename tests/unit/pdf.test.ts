import { describe, expect, it } from "vitest";
import {
  buildPdf,
  fitPdf,
  type EncodedPage,
} from "../../packages/scanfit/src/pdf";
function encoded(size: number, quality = 0.9, width = 2400): EncodedPage {
  // SOF-bearing synthetic JPEG payload: suitable for serializer tests, not image decoding.
  const bytes = new Uint8Array(Math.max(size, 32));
  bytes.set([
    255, 216, 255, 192, 0, 17, 8, 0, 16, 0, 16, 3, 1, 17, 0, 2, 17, 0, 3, 17, 0,
  ]);
  bytes[bytes.length - 2] = 255;
  bytes[bytes.length - 1] = 217;
  return {
    id: "page",
    jpeg: new Blob([bytes], { type: "image/jpeg" }),
    width,
    height: Math.round(width * 1.3),
    quality,
    warnings: [],
  };
}
describe("exact-size PDF contract", () => {
  it("writes valid PDF framing and structural overhead", async () => {
    const p = encoded(100);
    const b = await buildPdf([p]);
    expect(b.size).toBeGreaterThan(100);
    const text = await b.text();
    expect(text.startsWith("%PDF-1.4")).toBe(true);
    expect(text).toContain("/DCTDecode");
    expect(text).not.toContain("/JavaScript");
    expect(text).not.toContain("/Info");
  });
  it("accepts the exact byte boundary and rejects a byte less", async () => {
    const base = encoded(1000),
      size = (await buildPdf([base])).size;
    const source = [{ id: "page", warnings: [] }];
    const good = await fitPdf(
      source,
      { encode: async () => base },
      { maxBytes: size },
    );
    expect(good.status).toBe("ready");
    expect(good.blob.size).toBe(size);
    const bad = await fitPdf(
      source,
      { encode: async () => base },
      { maxBytes: size - 1 },
    );
    expect(bad.status).toBe("cannot-fit");
    expect(bad.report.bytes).toBe(bad.blob.size);
  });
  it("reduces candidates within floors and the attempt bound", async () => {
    const calls: { edge: number; q: number }[] = [];
    const r = await fitPdf(
      [
        { id: "a", warnings: [] },
        { id: "b", warnings: [] },
      ],
      {
        encode: async (i, edge, q) => {
          calls.push({ edge, q });
          return {
            ...encoded(Math.round(8000 * q * (edge / 2400)), q, edge),
            id: String(i),
          };
        },
      },
      { maxBytes: 10_000 },
    );
    expect(r.status).toBe("ready");
    expect(r.blob.size).toBeLessThanOrEqual(10_000);
    expect(calls.every((c) => c.q >= 0.65 && c.edge >= 1600)).toBe(true);
    expect(r.report.pages.every((p) => p.attempts <= 12)).toBe(true);
  });
  it("retains the smaller measured candidate when encoding is non-monotonic", async () => {
    const r = await fitPdf(
      [{ id: "a", warnings: [] }],
      {
        encode: async (_, edge, q) =>
          encoded(q === 0.8 ? 120 : q === 0.7 ? 300 : 500, q, edge),
      },
      { maxBytes: 1 },
    );
    expect(r.status).toBe("cannot-fit");
    expect(r.report.pages[0].imageBytes).toBe(120);
    expect(r.report.pages[0].attempts).toBeLessThanOrEqual(12);
  });
  it("preserves all pages even when impossible", async () => {
    const r = await fitPdf(
      [
        { id: "a", warnings: [] },
        { id: "b", warnings: [] },
      ],
      { encode: async () => encoded(200) },
      { maxBytes: 100 },
    );
    expect(r.status).toBe("cannot-fit");
    expect(r.report.pages).toHaveLength(2);
  });
  it("checks cancellation", async () => {
    const c = new AbortController();
    c.abort();
    await expect(
      fitPdf(
        [{ id: "a", warnings: [] }],
        { encode: async () => encoded(100) },
        { maxBytes: 1000, signal: c.signal },
      ),
    ).rejects.toMatchObject({ name: "AbortError" });
  });
  it.each([0, -1, NaN, 1.5, Infinity])(
    "rejects invalid maxBytes %s",
    async (maxBytes) => {
      await expect(
        fitPdf(
          [{ id: "a", warnings: [] }],
          { encode: async () => encoded(100) },
          { maxBytes },
        ),
      ).rejects.toThrow("maxBytes");
    },
  );
  it("does not accept an encoder PNG fallback", async () => {
    await expect(
      buildPdf([
        { ...encoded(100), jpeg: new Blob(["PNG"], { type: "image/png" }) },
      ]),
    ).rejects.toThrow("JPEG");
  });
});
