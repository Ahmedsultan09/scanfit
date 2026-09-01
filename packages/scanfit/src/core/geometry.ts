import { ScanError, type PageEdits, type Quad } from "./types";

export function validateQuad(q: Quad): void {
  if (
    !Array.isArray(q) ||
    q.length !== 4 ||
    q.some(
      (p) =>
        !p ||
        !Number.isFinite(p.x) ||
        !Number.isFinite(p.y) ||
        p.x < 0 ||
        p.x > 1 ||
        p.y < 0 ||
        p.y > 1,
    )
  )
    throw new ScanError(
      "INVALID_CORNERS",
      "Keep all four corners inside the image.",
    );
  let area = 0;
  for (let i = 0; i < 4; i++) {
    const a = q[i],
      b = q[(i + 1) % 4],
      c = q[(i + 2) % 4];
    if ((b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x) <= 0.00001)
      throw new ScanError(
        "INVALID_CORNERS",
        "Corners must form a clockwise, non-crossing document outline.",
      );
    area += a.x * b.y - b.x * a.y;
  }
  if (area < 0.01)
    throw new ScanError("INVALID_CORNERS", "Select a larger document area.");
}

export function fitDimensions(
  width: number,
  height: number,
  longEdge = 2400,
  maxPixels = 4_000_000,
) {
  const scale = Math.min(
    1,
    longEdge / Math.max(width, height),
    Math.sqrt(maxPixels / (width * height)),
  );
  return {
    width: Math.max(1, Math.floor(width * scale)),
    height: Math.max(1, Math.floor(height * scale)),
  };
}

function squareToQuad(q: Quad) {
  const [a, b, c, d] = q,
    dx1 = b.x - c.x,
    dx2 = d.x - c.x,
    dx3 = a.x - b.x + c.x - d.x;
  const dy1 = b.y - c.y,
    dy2 = d.y - c.y,
    dy3 = a.y - b.y + c.y - d.y;
  const den = dx1 * dy2 - dx2 * dy1;
  const g =
    Math.abs(dx3) + Math.abs(dy3) < 1e-12 ? 0 : (dx3 * dy2 - dx2 * dy3) / den;
  const h =
    Math.abs(dx3) + Math.abs(dy3) < 1e-12 ? 0 : (dx1 * dy3 - dx3 * dy1) / den;
  return [
    b.x - a.x + g * b.x,
    d.x - a.x + h * d.x,
    a.x,
    b.y - a.y + g * b.y,
    d.y - a.y + h * d.y,
    a.y,
    g,
    h,
  ];
}

/** Pure pixel transform; invoked only by the processing worker. */
export function warpPixels(source: ImageData, edits: PageEdits): ImageData {
  validateQuad(edits.corners);
  const q = edits.corners.map((p) => ({
    x: p.x * (source.width - 1),
    y: p.y * (source.height - 1),
  })) as Quad;
  const length = (a: number, b: number) =>
    Math.hypot(q[a].x - q[b].x, q[a].y - q[b].y);
  const dims = fitDimensions(
    Math.max(length(0, 1), length(3, 2)) + 1,
    Math.max(length(0, 3), length(1, 2)) + 1,
  );
  const swapped = edits.rotation === 90 || edits.rotation === 270;
  const w = swapped ? dims.height : dims.width,
    h = swapped ? dims.width : dims.height;
  const out = new Uint8ClampedArray(w * h * 4),
    m = squareToQuad(q),
    src = source.data;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const a = w > 1 ? x / (w - 1) : 0,
        b = h > 1 ? y / (h - 1) : 0;
      let u = a,
        v = b;
      if (edits.rotation === 90) {
        u = b;
        v = 1 - a;
      } else if (edits.rotation === 180) {
        u = 1 - a;
        v = 1 - b;
      } else if (edits.rotation === 270) {
        u = 1 - b;
        v = a;
      }
      const den = m[6] * u + m[7] * v + 1;
      const sx = Math.max(
        0,
        Math.min(source.width - 1, (m[0] * u + m[1] * v + m[2]) / den),
      );
      const sy = Math.max(
        0,
        Math.min(source.height - 1, (m[3] * u + m[4] * v + m[5]) / den),
      );
      const x0 = Math.floor(sx),
        y0 = Math.floor(sy),
        x1 = Math.min(x0 + 1, source.width - 1),
        y1 = Math.min(y0 + 1, source.height - 1),
        fx = sx - x0,
        fy = sy - y0;
      const i0 = (y0 * source.width + x0) * 4,
        i1 = (y0 * source.width + x1) * 4,
        i2 = (y1 * source.width + x0) * 4,
        i3 = (y1 * source.width + x1) * 4;
      const w0 = (1 - fx) * (1 - fy),
        w1 = fx * (1 - fy),
        w2 = (1 - fx) * fy,
        w3 = fx * fy;
      const a0 = src[i0 + 3] / 255,
        a1 = src[i1 + 3] / 255,
        a2 = src[i2 + 3] / 255,
        a3 = src[i3 + 3] / 255;
      const dst = (y * w + x) * 4;
      for (let channel = 0; channel < 3; channel++) {
        out[dst + channel] =
          (src[i0 + channel] * a0 + 255 * (1 - a0)) * w0 +
          (src[i1 + channel] * a1 + 255 * (1 - a1)) * w1 +
          (src[i2 + channel] * a2 + 255 * (1 - a2)) * w2 +
          (src[i3 + channel] * a3 + 255 * (1 - a3)) * w3;
      }
      if (edits.filter === "grayscale") {
        const g =
          0.2126 * out[dst] + 0.7152 * out[dst + 1] + 0.0722 * out[dst + 2];
        out[dst] = out[dst + 1] = out[dst + 2] = g;
      } else if (edits.filter === "contrast")
        for (let c = 0; c < 3; c++)
          out[dst + c] = (out[dst + c] - 128) * 1.15 + 128;
      out[dst + 3] = 255;
    }
  return new ImageData(out, w, h);
}
