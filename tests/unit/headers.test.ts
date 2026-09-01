import { describe, expect, it } from "vitest";
import {
  inspectImageBytes,
  inspectImage,
} from "../../packages/scanfit/src/core/headers";
import { DEFAULT_LIMITS } from "../../packages/scanfit/src/core/types";
import { stripJpegApp1 } from "../../packages/scanfit/src/core/jpeg";
function png(w: number, h: number) {
  const b = new Uint8Array(33),
    v = new DataView(b.buffer);
  v.setUint32(0, 0x89504e47);
  v.setUint32(4, 0x0d0a1a0a);
  v.setUint32(8, 13);
  v.setUint32(12, 0x49484452);
  v.setUint32(16, w);
  v.setUint32(20, h);
  return b;
}
function jpeg(orientation = 1) {
  const b = new Uint8Array(53),
    v = new DataView(b.buffer);
  b.set([
    255,
    216,
    255,
    225,
    0,
    34,
    69,
    120,
    105,
    102,
    0,
    0,
    73,
    73,
    42,
    0,
    8,
    0,
    0,
    0,
    1,
    0,
    18,
    1,
    3,
    0,
    1,
    0,
    0,
    0,
    orientation,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    255,
    192,
    0,
    11,
    8,
    0,
    20,
    0,
    30,
    1,
    1,
    17,
    0,
    255,
    217,
  ]);
  return b;
}
describe("safe header inspection", () => {
  it("recognizes PNG dimensions without trusting MIME or filename", () =>
    expect(inspectImageBytes(png(400, 500))).toMatchObject({
      mime: "image/png",
      width: 400,
      height: 500,
    }));
  it.each([1, 2, 3, 4, 5, 6, 7, 8])(
    "reads EXIF orientation %i",
    (orientation) =>
      expect(inspectImageBytes(jpeg(orientation))).toMatchObject({
        width: 30,
        height: 20,
        orientation,
      }),
  );
  it("does not reset JPEG orientation when an XMP APP1 follows EXIF", () => {
    const source = jpeg(6),
      b = new Uint8Array(source.length + 8);
    b.set(source.subarray(0, 38));
    b.set([255, 225, 0, 6, 88, 77, 80, 0], 38);
    b.set(source.subarray(38), 46);
    expect(inspectImageBytes(b).orientation).toBe(6);
  });
  it("uses the first valid EXIF orientation when JPEG metadata is duplicated", () => {
    const source = jpeg(6),
      second = jpeg(1),
      b = new Uint8Array(source.length + 36);
    b.set(source.subarray(0, 38));
    b.set(second.subarray(2, 38), 38);
    b.set(source.subarray(38), 74);
    expect(inspectImageBytes(b).orientation).toBe(6);
  });
  it("strips EXIF/XMP APP1 segments from encoded JPEGs", async () => {
    const source = jpeg(6),
      clean = new Uint8Array(
        await (await stripJpegApp1(new Blob([source]))).arrayBuffer(),
      );
    expect(clean.length).toBe(source.length - 36);
    expect(inspectImageBytes(clean)).toMatchObject({
      width: 30,
      height: 20,
      orientation: 1,
    });
  });
  it("reads PNG EXIF and rejects animated PNG", () => {
    const tiff = jpeg(8).slice(12, 38),
      b = new Uint8Array(33 + 12 + tiff.length),
      v = new DataView(b.buffer);
    b.set(png(30, 20));
    v.setUint32(33, tiff.length);
    v.setUint32(37, 0x65584966);
    b.set(tiff, 41);
    expect(inspectImageBytes(b).orientation).toBe(8);
    v.setUint32(37, 0x6163544c);
    expect(() => inspectImageBytes(b)).toThrow("Animated");
  });
  it("recognizes VP8X WebP and rejects animation", () => {
    const b = new Uint8Array(30),
      v = new DataView(b.buffer);
    v.setUint32(0, 0x52494646);
    v.setUint32(8, 0x57454250);
    v.setUint32(12, 0x56503858);
    v.setUint32(16, 10, true);
    b[24] = 99;
    b[27] = 49;
    expect(inspectImageBytes(b)).toMatchObject({
      width: 100,
      height: 50,
      mime: "image/webp",
    });
    b[20] = 2;
    expect(() => inspectImageBytes(b)).toThrow("Animated");
  });
  it.each([
    new Uint8Array(),
    new Uint8Array([1, 2, 3]),
    new Uint8Array([255, 216, 255, 225, 255, 255]),
    png(0, 3),
  ])("rejects malformed input", (bytes) =>
    expect(() => inspectImageBytes(bytes)).toThrow(),
  );
  it("rejects excessive pixels before decoding", async () => {
    await expect(
      inspectImage(new Blob([png(100_000, 100_000)]), DEFAULT_LIMITS),
    ).rejects.toMatchObject({ code: "LIMIT_EXCEEDED" });
  });
  it("rejects excessive bytes before reading", async () => {
    const blob = new Blob([png(100, 100)]);
    await expect(
      inspectImage(blob, { ...DEFAULT_LIMITS, maxFileBytes: 1 }),
    ).rejects.toMatchObject({ code: "LIMIT_EXCEEDED" });
  });
});
