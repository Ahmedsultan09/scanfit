import { describe, expect, it } from "vitest";
import { detectDocument } from "../../packages/scanfit/src/detector/scanfit-classical";
import type { Quad } from "../../packages/scanfit/src/core/types";

const WIDTH = 240;
const HEIGHT = 180;

function cross(
  a: { x: number; y: number },
  b: { x: number; y: number },
  c: { x: number; y: number },
) {
  return (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x);
}

function inside(quad: Quad, x: number, y: number) {
  const point = { x: x / (WIDTH - 1), y: y / (HEIGHT - 1) };
  return quad.every((corner, index) =>
    cross(corner, quad[(index + 1) % 4], point) >= 0,
  );
}

function quadIoU(actual: Quad, expected: Quad) {
  let intersection = 0,
    union = 0;
  for (let y = 0; y < 120; y++)
    for (let x = 0; x < 160; x++) {
      const point = { x: (x + 0.5) / 160, y: (y + 0.5) / 120 },
        inActual = actual.every((corner, index) =>
          cross(corner, actual[(index + 1) % 4], point) >= 0,
        ),
        inExpected = expected.every((corner, index) =>
          cross(corner, expected[(index + 1) % 4], point) >= 0,
        );
      if (inActual && inExpected) intersection++;
      if (inActual || inExpected) union++;
    }
  return intersection / Math.max(1, union);
}

function syntheticDocument({
  quad,
  background,
  paper,
  noise = 0,
  clutter = false,
  shadow = false,
}: {
  quad: Quad;
  background: number;
  paper: number;
  noise?: number;
  clutter?: boolean;
  shadow?: boolean;
}): ImageData {
  const data = new Uint8ClampedArray(WIDTH * HEIGHT * 4);
  let random = 0x12345678;
  const nextNoise = () => {
    random ^= random << 13;
    random ^= random >>> 17;
    random ^= random << 5;
    return ((random >>> 0) / 0xffffffff - 0.5) * noise;
  };
  const shadowQuad = quad.map((point) => ({
    x: Math.min(1, point.x + 0.025),
    y: Math.min(1, point.y + 0.035),
  })) as Quad;
  for (let y = 0; y < HEIGHT; y++)
    for (let x = 0; x < WIDTH; x++) {
      let value = background;
      if (clutter && !inside(quad, x, y)) {
        if ((x > 10 && x < 18) || (y > 148 && y < 153)) value += 32;
        if (x > 205 && y < 55) value -= 28;
      }
      if (shadow && inside(shadowQuad, x, y)) value -= 24;
      if (inside(quad, x, y)) {
        value = paper;
        // Text-like content must not displace the stronger document outline.
        const normalizedX = x / WIDTH,
          normalizedY = y / HEIGHT;
        if (
          normalizedY > 0.32 &&
          normalizedY < 0.76 &&
          Math.round(normalizedY * 30) % 3 === 0 &&
          normalizedX > 0.28 &&
          normalizedX < 0.7
        )
          value += paper > background ? -38 : 38;
      }
      value = Math.max(0, Math.min(255, value + nextNoise()));
      const index = (y * WIDTH + x) * 4;
      data[index] = data[index + 1] = data[index + 2] = value;
      data[index + 3] = 255;
    }
  return { data, width: WIDTH, height: HEIGHT } as ImageData;
}

function meanCornerError(actual: Quad, expected: Quad) {
  return (
    actual.reduce(
      (sum, point, index) =>
        sum + Math.hypot(point.x - expected[index].x, point.y - expected[index].y),
      0,
    ) / 4
  );
}

const perspective: Quad = [
  { x: 0.17, y: 0.13 },
  { x: 0.84, y: 0.2 },
  { x: 0.76, y: 0.88 },
  { x: 0.1, y: 0.79 },
];

describe("independent classical detector", () => {
  it("detects a bright perspective document with diagnostics", () => {
    const result = detectDocument(
      syntheticDocument({
        quad: perspective,
        background: 48,
        paper: 238,
        noise: 8,
        shadow: true,
      }),
    );
    expect(result.corners).not.toBeNull();
    expect(meanCornerError(result.corners!, perspective)).toBeLessThan(0.055);
    expect(quadIoU(result.corners!, perspective)).toBeGreaterThan(0.88);
    expect(result.confidence).toBeGreaterThanOrEqual(0.5);
    expect(result.diagnostics).toMatchObject({
      engine: "scanfit-classical",
      fallbackReason: undefined,
    });
    expect(result.diagnostics!.candidateCount).toBeGreaterThan(0);
    expect(result.diagnostics!.edgeSupport).toBeGreaterThan(0.28);
  });

  it("detects a dark rotated document on a bright surface", () => {
    const quad: Quad = [
      { x: 0.23, y: 0.08 },
      { x: 0.88, y: 0.3 },
      { x: 0.68, y: 0.92 },
      { x: 0.08, y: 0.68 },
    ];
    const result = detectDocument(
      syntheticDocument({
        quad,
        background: 224,
        paper: 54,
        noise: 10,
        clutter: true,
      }),
    );
    expect(result.corners).not.toBeNull();
    expect(meanCornerError(result.corners!, quad)).toBeLessThan(0.07);
    expect(quadIoU(result.corners!, quad)).toBeGreaterThan(0.84);
  });

  it("handles a low-contrast document and outside clutter", () => {
    const quad: Quad = [
      { x: 0.12, y: 0.18 },
      { x: 0.82, y: 0.12 },
      { x: 0.9, y: 0.81 },
      { x: 0.2, y: 0.9 },
    ];
    const result = detectDocument(
      syntheticDocument({
        quad,
        background: 132,
        paper: 166,
        noise: 5,
        clutter: true,
      }),
      { minConfidence: 0.4 },
    );
    expect(result.corners).not.toBeNull();
    expect(meanCornerError(result.corners!, quad)).toBeLessThan(0.085);
    expect(quadIoU(result.corners!, quad)).toBeGreaterThan(0.8);
  });

  it("detects a narrow receipt without preferring the background", () => {
    const quad: Quad = [
      { x: 0.36, y: 0.05 },
      { x: 0.69, y: 0.12 },
      { x: 0.64, y: 0.95 },
      { x: 0.31, y: 0.86 },
    ];
    const result = detectDocument(
      syntheticDocument({
        quad,
        background: 38,
        paper: 232,
        noise: 7,
        shadow: true,
      }),
    );
    expect(result.corners).not.toBeNull();
    expect(meanCornerError(result.corners!, quad)).toBeLessThan(0.07);
    expect(quadIoU(result.corners!, quad)).toBeGreaterThan(0.8);
    expect(result.diagnostics?.coverage).toBeLessThan(0.35);
  });

  it("does not invent a document in unstructured camera noise", () => {
    const data = new Uint8ClampedArray(WIDTH * HEIGHT * 4);
    let random = 0x9e3779b9;
    for (let y = 0; y < HEIGHT; y++)
      for (let x = 0; x < WIDTH; x++) {
        random ^= random << 13;
        random ^= random >>> 17;
        random ^= random << 5;
        const wave = 28 * Math.sin(x / 7) + 22 * Math.cos((x + y) / 11),
          value = Math.max(
            0,
            Math.min(255, 126 + wave + ((random >>> 24) - 128) * 0.35),
          ),
          index = (y * WIDTH + x) * 4;
        data[index] = value;
        data[index + 1] = Math.max(0, Math.min(255, value + 7));
        data[index + 2] = Math.max(0, Math.min(255, value - 9));
        data[index + 3] = 255;
      }
    const result = detectDocument({ data, width: WIDTH, height: HEIGHT } as ImageData);
    expect(result.corners).toBeNull();
    expect(result.diagnostics?.fallbackReason).toMatch(
      /low-confidence|no-candidate/,
    );
  });

  it("falls back honestly for a uniform image", () => {
    const data = new Uint8ClampedArray(WIDTH * HEIGHT * 4);
    for (let i = 0; i < data.length; i += 4) {
      data[i] = data[i + 1] = data[i + 2] = 127;
      data[i + 3] = 255;
    }
    const result = detectDocument({ data, width: WIDTH, height: HEIGHT } as ImageData);
    expect(result.corners).toBeNull();
    expect(result.confidence).toBe(0);
    expect(result.diagnostics?.fallbackReason).toBe("uniform-image");
  });

  it("rejects invalid tiny inputs without throwing", () => {
    const result = detectDocument({
      data: new Uint8ClampedArray(16 * 16 * 4),
      width: 16,
      height: 16,
    } as ImageData);
    expect(result.corners).toBeNull();
    expect(result.diagnostics?.fallbackReason).toBe("invalid-image");
  });

  it("uses safe defaults when the standalone adapter receives non-finite tuning", () => {
    const result = detectDocument(
      syntheticDocument({
        quad: perspective,
        background: 48,
        paper: 238,
      }),
      {
        minConfidence: Number.NaN,
        maxComponents: Number.NaN,
        maxCandidates: Number.NaN,
      },
    );
    expect(result.corners).not.toBeNull();
  });
});
