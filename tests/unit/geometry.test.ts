import { beforeAll, describe, expect, it, vi } from "vitest";
import {
  fitDimensions,
  validateQuad,
  warpPixels,
} from "../../packages/scanfit/src/core/geometry";
import { FULL_QUAD, type Quad } from "../../packages/scanfit/src/core/types";
beforeAll(() =>
  vi.stubGlobal(
    "ImageData",
    class {
      constructor(
        public data: Uint8ClampedArray,
        public width: number,
        public height: number,
      ) {}
    },
  ),
);
describe("geometry", () => {
  it("accepts a full clockwise quad", () =>
    expect(() => validateQuad(FULL_QUAD)).not.toThrow());
  it("rejects crossed corners", () =>
    expect(() =>
      validateQuad([FULL_QUAD[0], FULL_QUAD[2], FULL_QUAD[1], FULL_QUAD[3]]),
    ).toThrow());
  it("rejects tiny/NaN/outside quads", () => {
    for (const point of [
      { x: NaN, y: 0 },
      { x: -1, y: 0 },
      { x: 1, y: 1 },
    ])
      expect(() =>
        validateQuad([point, ...FULL_QUAD.slice(1)] as Quad),
      ).toThrow();
  });
  it("never upscales", () =>
    expect(fitDimensions(600, 800)).toEqual({ width: 600, height: 800 }));
  it("respects processing dimensions", () => {
    const d = fitDimensions(6000, 4000);
    expect(Math.max(d.width, d.height)).toBeLessThanOrEqual(2400);
    expect(d.width * d.height).toBeLessThanOrEqual(4_000_000);
  });
  it("preserves full-image corners and composites alpha white", () => {
    const src = new ImageData(
      new Uint8ClampedArray([
        255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255, 0, 0, 0, 0,
      ]),
      2,
      2,
    );
    const result = warpPixels(src, {
      corners: FULL_QUAD,
      rotation: 0,
      filter: "natural",
    });
    expect([result.width, result.height]).toEqual([2, 2]);
    expect(Array.from(result.data)).toEqual([
      255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255, 255, 255, 255, 255,
    ]);
  });
  it("rotates clockwise without changing colors", () => {
    const src = new ImageData(
      new Uint8ClampedArray([
        255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255, 255, 255, 255, 255,
      ]),
      2,
      2,
    );
    expect(
      Array.from(
        warpPixels(src, {
          corners: FULL_QUAD,
          rotation: 90,
          filter: "natural",
        }).data.slice(0, 4),
      ),
    ).toEqual([0, 0, 255, 255]);
  });
  it("only converts to grayscale when requested", () => {
    const src = new ImageData(new Uint8ClampedArray(16).fill(255), 2, 2);
    src.data[0] = 0;
    const p = warpPixels(src, {
      corners: FULL_QUAD,
      rotation: 0,
      filter: "grayscale",
    });
    expect(p.data[0]).toBe(p.data[1]);
    expect(p.data[1]).toBe(p.data[2]);
  });
});
