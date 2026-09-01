import { ScanError, type SafetyLimits } from "./types";

export interface ImageHeader {
  width: number;
  height: number;
  orientation: number;
  mime: string;
}
const bad = () =>
  new ScanError(
    "INVALID_INPUT",
    "The image header is incomplete or invalid. Choose another photo.",
  );

function exifOrientation(v: DataView, start: number, end: number): number {
  try {
    if (start + 8 > end) return 1;
    const prefixed =
      v.getUint32(start) === 0x45786966 && v.getUint16(start + 4) === 0;
    const t = start + (prefixed ? 6 : 0);
    if (t + 8 > end) return 1;
    const little = v.getUint16(t) === 0x4949;
    if (
      (!little && v.getUint16(t) !== 0x4d4d) ||
      v.getUint16(t + 2, little) !== 42
    )
      return 1;
    const dir = t + v.getUint32(t + 4, little);
    if (dir < t || dir + 2 > end) return 1;
    const count = Math.min(v.getUint16(dir, little), 256);
    for (let i = 0; i < count; i++) {
      const p = dir + 2 + i * 12;
      if (p + 12 > end) return 1;
      if (
        v.getUint16(p, little) === 0x112 &&
        v.getUint16(p + 2, little) === 3 &&
        v.getUint32(p + 4, little) === 1
      ) {
        const value = v.getUint16(p + 8, little);
        return value >= 1 && value <= 8 ? value : 1;
      }
    }
  } catch {
    /* Malformed metadata is not used for allocations. */
  }
  return 1;
}

/** Bounded header inspection before any image decoder is called. */
export function inspectImageBytes(bytes: Uint8Array): ImageHeader {
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let width = 0,
    height = 0,
    orientation = 1,
    mime = "";
  if (
    bytes.length >= 24 &&
    v.getUint32(0) === 0x89504e47 &&
    v.getUint32(4) === 0x0d0a1a0a
  ) {
    if (v.getUint32(12) !== 0x49484452 || v.getUint32(8) !== 13) throw bad();
    width = v.getUint32(16);
    height = v.getUint32(20);
    mime = "image/png";
    for (let i = 8; i + 12 <= bytes.length; ) {
      const len = v.getUint32(i),
        kind = v.getUint32(i + 4),
        p = i + 8;
      if (p + len + 4 > bytes.length) throw bad();
      if (kind === 0x6163544c)
        throw new ScanError(
          "UNSUPPORTED_FORMAT",
          "Animated PNG is not supported. Choose a still photo.",
        );
      if (kind === 0x65584966) orientation = exifOrientation(v, p, p + len);
      i = p + len + 4;
    }
  } else if (bytes.length >= 4 && v.getUint16(0) === 0xffd8) {
    mime = "image/jpeg";
    let i = 2;
    while (i + 3 < bytes.length) {
      if (bytes[i++] !== 0xff) throw bad();
      while (bytes[i] === 0xff) i++;
      const marker = bytes[i++];
      if (marker === 0xda || marker === 0xd9) break;
      if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
      if (i + 2 > bytes.length) throw bad();
      const len = v.getUint16(i);
      if (len < 2 || i + len > bytes.length) throw bad();
      if (
        marker === 0xe1 &&
        len >= 8 &&
        v.getUint32(i + 2) === 0x45786966 &&
        v.getUint16(i + 6) === 0
      )
        orientation = exifOrientation(v, i + 2, i + len);
      if (
        marker >= 0xc0 &&
        marker <= 0xcf &&
        ![0xc4, 0xc8, 0xcc].includes(marker)
      ) {
        if (len < 8) throw bad();
        const h = v.getUint16(i + 3),
          w = v.getUint16(i + 5);
        if ((width && width !== w) || (height && height !== h)) throw bad();
        height = h;
        width = w;
      }
      i += len;
    }
  } else if (
    bytes.length >= 30 &&
    v.getUint32(0) === 0x52494646 &&
    v.getUint32(8) === 0x57454250
  ) {
    mime = "image/webp";
    for (let i = 12; i + 8 <= bytes.length; ) {
      const kind = v.getUint32(i),
        len = v.getUint32(i + 4, true),
        p = i + 8;
      if (p + len > bytes.length) throw bad();
      if (kind === 0x56503858 && len >= 10) {
        if (bytes[p] & 2)
          throw new ScanError(
            "UNSUPPORTED_FORMAT",
            "Animated WebP is not supported. Choose a still photo.",
          );
        width = Math.max(
          width,
          1 + bytes[p + 4] + (bytes[p + 5] << 8) + (bytes[p + 6] << 16),
        );
        height = Math.max(
          height,
          1 + bytes[p + 7] + (bytes[p + 8] << 8) + (bytes[p + 9] << 16),
        );
      }
      if (
        kind === 0x56503820 &&
        len >= 10 &&
        bytes[p + 3] === 0x9d &&
        bytes[p + 4] === 1 &&
        bytes[p + 5] === 0x2a
      ) {
        width = Math.max(width, v.getUint16(p + 6, true) & 0x3fff);
        height = Math.max(height, v.getUint16(p + 8, true) & 0x3fff);
      }
      if (kind === 0x5650384c && len >= 5 && bytes[p] === 0x2f) {
        const bits = v.getUint32(p + 1, true);
        width = Math.max(width, (bits & 0x3fff) + 1);
        height = Math.max(height, ((bits >>> 14) & 0x3fff) + 1);
      }
      if (kind === 0x45584946) orientation = exifOrientation(v, p, p + len);
      i = p + len + (len & 1);
    }
  } else
    throw new ScanError(
      "UNSUPPORTED_FORMAT",
      "Choose a JPEG, PNG, or WebP photo. PDF and HEIC imports are not included in this beta.",
    );
  if (!width || !height || !Number.isSafeInteger(width * height)) throw bad();
  return { width, height, orientation, mime };
}

export async function inspectImage(
  blob: Blob,
  limits: SafetyLimits,
): Promise<ImageHeader> {
  if (!blob.size) throw bad();
  if (blob.size > limits.maxFileBytes)
    throw new ScanError(
      "LIMIT_EXCEEDED",
      "This photo exceeds the input file-size limit. Choose a smaller photo.",
    );
  // JPEG metadata may be large. Read the bounded input, but never decode it here.
  const header = inspectImageBytes(new Uint8Array(await blob.arrayBuffer()));
  if (header.width * header.height > limits.maxPixels)
    throw new ScanError(
      "LIMIT_EXCEEDED",
      "This photo exceeds the pixel limit. Export it at a lower resolution.",
    );
  return header;
}
