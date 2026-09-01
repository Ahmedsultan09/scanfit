import { validateQuad } from "../core/geometry";
import type {
  DetectionDiagnostics,
  DetectionResult,
  DetectorOptions,
  Quad,
} from "../core/types";

export type ClassicalDetectorOptions = DetectorOptions;

type PixelPoint = { x: number; y: number };
type CandidateSource =
  | "edges"
  | "hough-lines"
  | "bright-region"
  | "dark-region"
  | "border-contrast";
type Candidate = { points: PixelPoint[]; source: CandidateSource };
type CandidateMetrics = {
  score: number;
  confidence: number;
  coverage: number;
  edgeSupport: number;
  contrast: number;
  rectangularity: number;
};
type Component = {
  count: number;
  boundsArea: number;
  touches: number;
  boundary: PixelPoint[];
};

const DEFAULT_MIN_CONFIDENCE = 0.5;
const clamp = (value: number, min = 0, max = 1) =>
  Math.max(min, Math.min(max, value));
const now = () =>
  typeof performance === "undefined" ? Date.now() : performance.now();

function grayscale(image: ImageData): Uint8Array {
  const output = new Uint8Array(image.width * image.height);
  for (let i = 0, p = 0; p < output.length; p++, i += 4) {
    const alpha = image.data[i + 3] / 255;
    const luminance =
      (77 * image.data[i] +
        150 * image.data[i + 1] +
        29 * image.data[i + 2]) >>
      8;
    output[p] = Math.round(luminance * alpha + 255 * (1 - alpha));
  }
  return output;
}

/** Small separable box blur. Detection is capped at 800px, so JS stays cheap. */
function blur(source: Uint8Array, width: number, height: number): Uint8Array {
  const radius = Math.max(width, height) >= 600 ? 2 : 1;
  const span = radius * 2 + 1;
  const horizontal = new Uint8Array(source.length);
  const output = new Uint8Array(source.length);
  for (let y = 0; y < height; y++) {
    const row = y * width;
    for (let x = 0; x < width; x++) {
      let sum = 0;
      for (let k = -radius; k <= radius; k++)
        sum += source[row + Math.max(0, Math.min(width - 1, x + k))];
      horizontal[row + x] = Math.round(sum / span);
    }
  }
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      let sum = 0;
      for (let k = -radius; k <= radius; k++)
        sum +=
          horizontal[
            Math.max(0, Math.min(height - 1, y + k)) * width + x
          ];
      output[y * width + x] = Math.round(sum / span);
    }
  return output;
}

function gradients(source: Uint8Array, width: number, height: number) {
  const magnitude = new Uint16Array(source.length);
  const histogram = new Uint32Array(2041);
  let nonzero = 0;
  for (let y = 1; y < height - 1; y++)
    for (let x = 1; x < width - 1; x++) {
      const i = y * width + x;
      const gx =
        -source[i - width - 1] +
        source[i - width + 1] -
        2 * source[i - 1] +
        2 * source[i + 1] -
        source[i + width - 1] +
        source[i + width + 1];
      const gy =
        -source[i - width - 1] -
        2 * source[i - width] -
        source[i - width + 1] +
        source[i + width - 1] +
        2 * source[i + width] +
        source[i + width + 1];
      const value = Math.min(2040, Math.abs(gx) + Math.abs(gy));
      magnitude[i] = value;
      if (value) {
        histogram[value]++;
        nonzero++;
      }
    }
  let cumulative = 0;
  const target = nonzero * 0.82;
  let percentile = 0;
  for (let value = 1; value < histogram.length; value++) {
    cumulative += histogram[value];
    if (cumulative >= target) {
      percentile = value;
      break;
    }
  }
  return {
    magnitude,
    threshold: Math.round(clamp(percentile || 24, 24, 600)),
    nonzero,
  };
}

/** Canny-style dual-threshold connectivity without direction quantization. */
function connectedEdges(
  magnitude: Uint16Array,
  width: number,
  height: number,
  high: number,
) {
  const state = new Uint8Array(magnitude.length);
  const queue = new Int32Array(magnitude.length);
  const low = high * 0.42;
  let head = 0,
    tail = 0,
    strong = 0;
  for (let i = 0; i < magnitude.length; i++) {
    if (magnitude[i] >= high) {
      state[i] = 2;
      queue[tail++] = i;
      strong++;
    } else if (magnitude[i] >= low) state[i] = 1;
  }
  while (head < tail) {
    const index = queue[head++],
      x = index % width,
      y = Math.floor(index / width);
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) {
        if (
          (!dx && !dy) ||
          x + dx < 0 ||
          x + dx >= width ||
          y + dy < 0 ||
          y + dy >= height
        )
          continue;
        const next = index + dy * width + dx;
        if (state[next] === 1) {
          state[next] = 2;
          queue[tail++] = next;
        }
      }
  }
  const binary = new Uint8Array(state.length);
  let count = 0;
  for (let i = 0; i < state.length; i++)
    if (state[i] === 2) {
      binary[i] = 1;
      count++;
    }
  return { binary, density: count / binary.length, strong };
}

function dilate(source: Uint8Array, width: number, height: number) {
  const output = new Uint8Array(source.length);
  for (let y = 1; y < height - 1; y++)
    for (let x = 1; x < width - 1; x++) {
      const i = y * width + x;
      if (
        source[i] ||
        source[i - 1] ||
        source[i + 1] ||
        source[i - width] ||
        source[i + width] ||
        source[i - width - 1] ||
        source[i - width + 1] ||
        source[i + width - 1] ||
        source[i + width + 1]
      )
        output[i] = 1;
    }
  return output;
}

function otsu(source: Uint8Array) {
  const histogram = new Uint32Array(256);
  for (const value of source) histogram[value]++;
  let totalMean = 0;
  for (let i = 0; i < 256; i++) totalMean += i * histogram[i];
  let lowerCount = 0,
    lowerMean = 0,
    bestVariance = -1,
    threshold = 127;
  for (let i = 0; i < 255; i++) {
    lowerCount += histogram[i];
    lowerMean += i * histogram[i];
    const upperCount = source.length - lowerCount;
    if (!lowerCount || !upperCount) continue;
    const difference =
      lowerMean / lowerCount - (totalMean - lowerMean) / upperCount;
    const variance = lowerCount * upperCount * difference * difference;
    if (variance > bestVariance) {
      bestVariance = variance;
      threshold = i;
    }
  }
  return threshold;
}

function borderStatistics(
  source: Uint8Array,
  width: number,
  height: number,
) {
  const histogram = new Uint32Array(256);
  let count = 0;
  const add = (value: number) => {
    histogram[value]++;
    count++;
  };
  for (let x = 0; x < width; x++) {
    add(source[x]);
    add(source[(height - 1) * width + x]);
  }
  for (let y = 1; y < height - 1; y++) {
    add(source[y * width]);
    add(source[y * width + width - 1]);
  }
  let sum = 0,
    median = 127;
  for (let i = 0; i < histogram.length; i++) {
    sum += histogram[i];
    if (sum >= count / 2) {
      median = i;
      break;
    }
  }
  const deviations = new Uint32Array(256);
  for (let i = 0; i < histogram.length; i++)
    deviations[Math.abs(i - median)] += histogram[i];
  sum = 0;
  let deviation = 0;
  for (let i = 0; i < deviations.length; i++) {
    sum += deviations[i];
    if (sum >= count / 2) {
      deviation = i;
      break;
    }
  }
  return { median, deviation };
}

function thresholdMaps(source: Uint8Array, width: number, height: number) {
  const threshold = otsu(source);
  const border = borderStatistics(source, width, height);
  const bright = new Uint8Array(source.length),
    dark = new Uint8Array(source.length),
    contrast = new Uint8Array(source.length);
  const distance = Math.max(16, border.deviation * 2.5);
  for (let i = 0; i < source.length; i++) {
    bright[i] = source[i] > threshold ? 1 : 0;
    dark[i] = source[i] <= threshold ? 1 : 0;
    contrast[i] = Math.abs(source[i] - border.median) >= distance ? 1 : 0;
  }
  return { bright, dark, contrast };
}

function components(
  binary: Uint8Array,
  width: number,
  height: number,
  filled: boolean,
  maximum: number,
): Component[] {
  const seen = new Uint8Array(binary.length);
  const queue = new Int32Array(binary.length);
  const results: Component[] = [];
  const minimumCount = filled
    ? Math.max(64, binary.length * 0.025)
    : Math.max(40, (width + height) * 0.06);
  for (let start = 0; start < binary.length; start++) {
    if (!binary[start] || seen[start]) continue;
    let head = 0,
      tail = 0,
      count = 0,
      boundaryCount = 0,
      minX = width,
      minY = height,
      maxX = 0,
      maxY = 0,
      touches = 0;
    const boundary: PixelPoint[] = [];
    const extrema: Array<PixelPoint | undefined> = new Array(8);
    const extremaValues = [
      Infinity,
      -Infinity,
      Infinity,
      -Infinity,
      Infinity,
      -Infinity,
      Infinity,
      -Infinity,
    ];
    queue[tail++] = start;
    seen[start] = 1;
    while (head < tail) {
      const index = queue[head++],
        x = index % width,
        y = Math.floor(index / width);
      count++;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
      if (x === 0 || x === width - 1 || y === 0 || y === height - 1)
        touches++;
      const values = [x + y, x + y, x - y, x - y, x, x, y, y];
      for (let e = 0; e < 8; e++) {
        const better =
          e % 2
            ? values[e] > extremaValues[e]
            : values[e] < extremaValues[e];
        if (better) {
          extremaValues[e] = values[e];
          extrema[e] = { x, y };
        }
      }
      let isBoundary = false;
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dy) continue;
          const nx = x + dx,
            ny = y + dy;
          if (nx < 0 || nx >= width || ny < 0 || ny >= height) {
            isBoundary = true;
            continue;
          }
          const next = ny * width + nx;
          if (!binary[next]) isBoundary = true;
          else if (!seen[next]) {
            seen[next] = 1;
            queue[tail++] = next;
          }
        }
      if (isBoundary) {
        boundaryCount++;
        if (boundary.length < 2048) boundary.push({ x, y });
        else {
          const replacement =
            ((Math.imul(boundaryCount, 2654435761) >>> 0) % boundaryCount) |
            0;
          if (replacement < boundary.length)
            boundary[replacement] = { x, y };
        }
      }
    }
    const boundsArea = (maxX - minX + 1) * (maxY - minY + 1);
    if (
      count >= minimumCount &&
      boundsArea >= binary.length * 0.055 &&
      count < binary.length * 0.985
    ) {
      for (const point of extrema) if (point) boundary.push(point);
      results.push({ count, boundsArea, touches, boundary });
    }
  }
  return results
    .sort(
      (a, b) =>
        b.boundsArea * Math.min(1, b.count / minimumCount) -
        a.boundsArea * Math.min(1, a.count / minimumCount),
    )
    .slice(0, maximum);
}

const cross = (o: PixelPoint, a: PixelPoint, b: PixelPoint) =>
  (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);

function convexHull(input: PixelPoint[]) {
  const points = [...input]
    .sort((a, b) => a.x - b.x || a.y - b.y)
    .filter(
      (point, index, all) =>
        !index ||
        point.x !== all[index - 1].x ||
        point.y !== all[index - 1].y,
    );
  if (points.length <= 4) return points;
  const lower: PixelPoint[] = [],
    upper: PixelPoint[] = [];
  for (const point of points) {
    while (
      lower.length >= 2 &&
      cross(lower.at(-2)!, lower.at(-1)!, point) <= 0
    )
      lower.pop();
    lower.push(point);
  }
  for (let i = points.length - 1; i >= 0; i--) {
    const point = points[i];
    while (
      upper.length >= 2 &&
      cross(upper.at(-2)!, upper.at(-1)!, point) <= 0
    )
      upper.pop();
    upper.push(point);
  }
  lower.pop();
  upper.pop();
  return [...lower, ...upper];
}

function reduceHull(points: PixelPoint[]) {
  const output = [...points];
  while (output.length > 4) {
    let remove = 0,
      leastContribution = Infinity;
    for (let i = 0; i < output.length; i++) {
      const previous = output[(i + output.length - 1) % output.length],
        point = output[i],
        next = output[(i + 1) % output.length];
      const contribution = Math.abs(cross(previous, point, next));
      if (contribution < leastContribution) {
        leastContribution = contribution;
        remove = i;
      }
    }
    output.splice(remove, 1);
  }
  return output;
}

type HoughLine = {
  theta: number;
  rho: number;
  votes: number;
};

function angleDistance(a: number, b: number) {
  const difference = Math.abs(a - b) % Math.PI;
  return Math.min(difference, Math.PI - difference);
}

function intersectLines(a: HoughLine, b: HoughLine): PixelPoint | null {
  const ac = Math.cos(a.theta),
    as = Math.sin(a.theta),
    bc = Math.cos(b.theta),
    bs = Math.sin(b.theta),
    determinant = ac * bs - as * bc;
  if (Math.abs(determinant) < 0.08) return null;
  return {
    x: (a.rho * bs - as * b.rho) / determinant,
    y: (ac * b.rho - a.rho * bc) / determinant,
  };
}

/**
 * Standard polar Hough voting. Thin clutter can join an otherwise useful edge
 * component; line-pair candidates recover the four document boundaries without
 * depending on connected-component purity.
 */
function houghCandidates(
  magnitude: Uint16Array,
  threshold: number,
  width: number,
  height: number,
): Candidate[] {
  const points: PixelPoint[] = [];
  let eligible = 0;
  for (let y = 1; y < height - 1; y++)
    for (let x = 1; x < width - 1; x++) {
      if (magnitude[y * width + x] < threshold) continue;
      eligible++;
      if (points.length < 5000) points.push({ x, y });
      else {
        const replacement =
          ((Math.imul(eligible, 2246822519) >>> 0) % eligible) | 0;
        if (replacement < points.length) points[replacement] = { x, y };
      }
    }
  if (points.length < 24) return [];
  const thetaBins = 90,
    rhoStep = 2,
    diagonal = Math.hypot(width, height),
    rhoBins = Math.ceil((diagonal * 2) / rhoStep) + 1,
    accumulator = new Uint16Array(thetaBins * rhoBins),
    cosine = new Float32Array(thetaBins),
    sine = new Float32Array(thetaBins);
  for (let theta = 0; theta < thetaBins; theta++) {
    const angle = (theta * Math.PI) / thetaBins;
    cosine[theta] = Math.cos(angle);
    sine[theta] = Math.sin(angle);
  }
  for (const point of points)
    for (let theta = 0; theta < thetaBins; theta++) {
      const rho = Math.round(
        (point.x * cosine[theta] + point.y * sine[theta] + diagonal) /
          rhoStep,
      );
      const index = theta * rhoBins + rho;
      if (accumulator[index] < 65535) accumulator[index]++;
    }
  const peakMinimum = Math.max(10, Math.round(Math.min(width, height) * 0.055));
  const rawPeaks: HoughLine[] = [];
  for (let theta = 0; theta < thetaBins; theta++)
    for (let rho = 1; rho < rhoBins - 1; rho++) {
      const votes = accumulator[theta * rhoBins + rho];
      if (votes < peakMinimum) continue;
      rawPeaks.push({
        theta: (theta * Math.PI) / thetaBins,
        rho: rho * rhoStep - diagonal,
        votes,
      });
    }
  rawPeaks.sort((a, b) => b.votes - a.votes);
  const peaks: HoughLine[] = [];
  for (const peak of rawPeaks) {
    if (
      peaks.some(
        (accepted) =>
          angleDistance(peak.theta, accepted.theta) <
            (4 * Math.PI) / thetaBins &&
          Math.abs(peak.rho - accepted.rho) < rhoStep * 5,
      )
    )
      continue;
    peaks.push(peak);
    if (peaks.length >= 28) break;
  }
  const pairs: Array<{ lines: [HoughLine, HoughLine]; score: number }> = [];
  for (let i = 0; i < peaks.length; i++)
    for (let j = i + 1; j < peaks.length; j++) {
      const separation = Math.abs(peaks[i].rho - peaks[j].rho),
        difference = angleDistance(peaks[i].theta, peaks[j].theta);
      if (
        difference <= (16 * Math.PI) / 180 &&
        separation >= Math.min(width, height) * 0.16
      )
        pairs.push({
          lines: [peaks[i], peaks[j]],
          score:
            peaks[i].votes +
            peaks[j].votes -
            (difference * 180) / Math.PI,
        });
    }
  pairs.sort((a, b) => b.score - a.score);
  const results: Array<Candidate & { score: number }> = [];
  for (let i = 0; i < Math.min(16, pairs.length); i++)
    for (let j = i + 1; j < Math.min(16, pairs.length); j++) {
      const orientation = angleDistance(
        pairs[i].lines[0].theta,
        pairs[j].lines[0].theta,
      );
      if (orientation < (38 * Math.PI) / 180) continue;
      const [a, b] = pairs[i].lines,
        [c, d] = pairs[j].lines;
      const points = [
        intersectLines(a, c),
        intersectLines(b, c),
        intersectLines(b, d),
        intersectLines(a, d),
      ];
      if (
        points.some(
          (point) =>
            !point ||
            point.x < -width * 0.03 ||
            point.x > width * 1.03 ||
            point.y < -height * 0.03 ||
            point.y > height * 1.03,
        )
      )
        continue;
      results.push({
        points: points as PixelPoint[],
        source: "hough-lines",
        score: pairs[i].score + pairs[j].score,
      });
    }
  return results
    .sort((a, b) => b.score - a.score)
    .slice(0, 20)
    .map(({ points, source }) => ({ points, source }));
}

function extremeQuad(points: PixelPoint[]) {
  if (points.length < 4) return [];
  const selectors = [
    (point: PixelPoint) => point.x + point.y,
    (point: PixelPoint) => -(point.x - point.y),
    (point: PixelPoint) => -(point.x + point.y),
    (point: PixelPoint) => point.x - point.y,
  ];
  return selectors.map((select) =>
    points.reduce((best, point) =>
      select(point) < select(best) ? point : best,
    ),
  );
}

function orderedQuad(
  input: PixelPoint[],
  width: number,
  height: number,
): Quad | null {
  if (
    input.length !== 4 ||
    new Set(input.map((point) => `${point.x},${point.y}`)).size !== 4
  )
    return null;
  const center = input.reduce(
    (sum, point) => ({
      x: sum.x + point.x / 4,
      y: sum.y + point.y / 4,
    }),
    { x: 0, y: 0 },
  );
  let points = [...input].sort(
    (a, b) =>
      Math.atan2(a.y - center.y, a.x - center.x) -
      Math.atan2(b.y - center.y, b.x - center.x),
  );
  let start = 0;
  for (let i = 1; i < 4; i++)
    if (points[i].x + points[i].y < points[start].x + points[start].y)
      start = i;
  points = [...points.slice(start), ...points.slice(0, start)];
  if (cross(points[0], points[1], points[2]) < 0)
    points = [points[0], points[3], points[2], points[1]];
  const quad = points.map((point) => ({
    x: clamp(point.x / Math.max(1, width - 1)),
    y: clamp(point.y / Math.max(1, height - 1)),
  })) as Quad;
  try {
    validateQuad(quad);
    return quad;
  } catch {
    return null;
  }
}

function area(quad: Quad) {
  let sum = 0;
  for (let i = 0; i < 4; i++) {
    const a = quad[i],
      b = quad[(i + 1) % 4];
    sum += a.x * b.y - b.x * a.y;
  }
  return Math.abs(sum) / 2;
}

function sample(
  source: Uint8Array | Uint16Array,
  width: number,
  height: number,
  x: number,
  y: number,
) {
  const px = Math.max(0, Math.min(width - 1, Math.round(x))),
    py = Math.max(0, Math.min(height - 1, Math.round(y)));
  return source[py * width + px];
}

function scoreCandidate(
  quad: Quad,
  gray: Uint8Array,
  gradient: Uint16Array,
  threshold: number,
  width: number,
  height: number,
): CandidateMetrics | null {
  const coverage = area(quad);
  if (coverage < 0.055 || coverage > 0.985) return null;
  const points = quad.map((point) => ({
    x: point.x * (width - 1),
    y: point.y * (height - 1),
  }));
  const sides = points.map((point, index) => {
    const next = points[(index + 1) % 4];
    return {
      dx: next.x - point.x,
      dy: next.y - point.y,
      length: Math.hypot(next.x - point.x, next.y - point.y),
    };
  });
  const diagonal = Math.hypot(width, height);
  const shortest = Math.min(...sides.map((side) => side.length)) / diagonal;
  if (shortest < 0.055) return null;
  let angleScore = 0;
  for (let i = 0; i < 4; i++) {
    const previous = points[(i + 3) % 4],
      point = points[i],
      next = points[(i + 1) % 4],
      ax = previous.x - point.x,
      ay = previous.y - point.y,
      bx = next.x - point.x,
      by = next.y - point.y;
    const cosine = Math.abs(
      (ax * bx + ay * by) /
        Math.max(1, Math.hypot(ax, ay) * Math.hypot(bx, by)),
    );
    angleScore += 1 - clamp(cosine / 0.72);
  }
  angleScore /= 4;
  let supported = 0,
    strength = 0,
    contrast = 0,
    samples = 0;
  for (let sideIndex = 0; sideIndex < 4; sideIndex++) {
    const start = points[sideIndex],
      side = sides[sideIndex],
      steps = Math.max(12, Math.min(180, Math.round(side.length / 2))),
      nx = -side.dy / Math.max(1, side.length),
      ny = side.dx / Math.max(1, side.length);
    for (let step = 1; step < steps; step++) {
      const ratio = step / steps,
        x = start.x + side.dx * ratio,
        y = start.y + side.dy * ratio;
      let strongest = 0;
      for (let offset = -2; offset <= 2; offset++)
        strongest = Math.max(
          strongest,
          sample(
            gradient,
            width,
            height,
            x + nx * offset,
            y + ny * offset,
          ),
        );
      supported += strongest >= threshold * 0.7 ? 1 : 0;
      strength += clamp(strongest / Math.max(1, threshold * 1.8));
      const inside = sample(
          gray,
          width,
          height,
          x + nx * 4,
          y + ny * 4,
        ),
        outside = sample(
          gray,
          width,
          height,
          x - nx * 4,
          y - ny * 4,
        );
      contrast += clamp(Math.abs(inside - outside) / 48);
      samples++;
    }
  }
  const edgeSupport = samples
    ? 0.67 * (supported / samples) + 0.33 * (strength / samples)
    : 0;
  contrast = samples ? contrast / samples : 0;
  const coverageScore =
    clamp((coverage - 0.055) / 0.3) *
    clamp((0.985 - coverage) / 0.08);
  const sideScore = clamp((shortest - 0.055) / 0.18);
  const rectangularity = 0.72 * angleScore + 0.28 * sideScore;
  const borderScore =
    quad.reduce(
      (sum, point) =>
        sum +
        clamp(
          Math.min(point.x, point.y, 1 - point.x, 1 - point.y) / 0.025,
        ),
      0,
    ) / 4;
  const evidenceScore =
    0.43 * edgeSupport +
    0.2 * contrast +
    0.15 * coverageScore +
    0.17 * rectangularity +
    0.05 * sideScore;
  // Full-frame background regions are common thresholding artifacts. A real
  // page may touch one edge, so this is deliberately a soft—not absolute—gate.
  const score = evidenceScore * (0.56 + 0.44 * borderScore);
  return {
    score,
    confidence: clamp((score - 0.3) / 0.55),
    coverage,
    edgeSupport,
    contrast,
    rectangularity,
  };
}

function diagnostics(
  started: number,
  confidence: number,
  candidateCount: number,
  edgeThreshold: number,
  edgeDensity: number,
  metrics?: CandidateMetrics,
  fallbackReason?: DetectionDiagnostics["fallbackReason"],
): DetectionDiagnostics {
  return {
    engine: "scanfit-classical",
    confidence,
    candidateCount,
    edgeThreshold,
    edgeDensity,
    durationMs: Math.max(0, now() - started),
    coverage: metrics?.coverage ?? 0,
    edgeSupport: metrics?.edgeSupport ?? 0,
    contrast: metrics?.contrast ?? 0,
    rectangularity: metrics?.rectangularity ?? 0,
    fallbackReason,
  };
}

/** Independent detector entry point, exported separately for deterministic tests. */
export function detectDocument(
  image: ImageData,
  options: ClassicalDetectorOptions = {},
): DetectionResult {
  const started = now(),
    width = image.width,
    height = image.height;
  if (
    !Number.isSafeInteger(width) ||
    !Number.isSafeInteger(height) ||
    width < 32 ||
    height < 32 ||
    image.data.length !== width * height * 4
  )
    return {
      corners: null,
      confidence: 0,
      diagnostics: diagnostics(
        started,
        0,
        0,
        0,
        0,
        undefined,
        "invalid-image",
      ),
    };
  const gray = blur(grayscale(image), width, height),
    gradient = gradients(gray, width, height),
    edges = connectedEdges(
      gradient.magnitude,
      width,
      height,
      gradient.threshold,
    );
  if (gradient.nonzero < image.width + image.height || edges.strong < 8)
    return {
      corners: null,
      confidence: 0,
      diagnostics: diagnostics(
        started,
        0,
        0,
        gradient.threshold,
        edges.density,
        undefined,
        "uniform-image",
      ),
    };
  const maps = thresholdMaps(gray, width, height);
  const evidence: Array<{
    binary: Uint8Array;
    source: CandidateSource;
    filled: boolean;
  }> = [
    {
      binary: dilate(edges.binary, width, height),
      source: "edges",
      filled: false,
    },
    { binary: maps.bright, source: "bright-region", filled: true },
    { binary: maps.dark, source: "dark-region", filled: true },
    { binary: maps.contrast, source: "border-contrast", filled: true },
  ];
  const maximumComponents = Math.max(
    1,
    Math.min(
      16,
      Number.isSafeInteger(options.maxComponents)
        ? options.maxComponents!
        : 8,
    ),
  );
  const candidates: Candidate[] = [];
  candidates.push(
    ...houghCandidates(
      gradient.magnitude,
      gradient.threshold,
      width,
      height,
    ),
  );
  for (const item of evidence)
    for (const component of components(
      item.binary,
      width,
      height,
      item.filled,
      maximumComponents,
    )) {
      if (
        component.touches > component.count * 0.45 &&
        component.boundsArea > width * height * 0.9
      )
        continue;
      const hull = convexHull(component.boundary);
      if (hull.length >= 4) {
        candidates.push({ points: reduceHull(hull), source: item.source });
        candidates.push({ points: extremeQuad(hull), source: item.source });
      }
    }
  const maximumCandidates = Math.max(
    1,
    Math.min(
      64,
      Number.isSafeInteger(options.maxCandidates)
        ? options.maxCandidates!
        : 24,
    ),
  );
  const unique = new Map<string, { quad: Quad; source: CandidateSource }>();
  for (const candidate of candidates) {
    const quad = orderedQuad(candidate.points, width, height);
    if (!quad) continue;
    const key = quad
      .map(
        (point) =>
          `${Math.round(point.x * 40)},${Math.round(point.y * 40)}`,
      )
      .join(";");
    if (!unique.has(key))
      unique.set(key, { quad, source: candidate.source });
    if (unique.size >= maximumCandidates) break;
  }
  let best:
    | { quad: Quad; metrics: CandidateMetrics; source: CandidateSource }
    | undefined;
  for (const candidate of unique.values()) {
    const metrics = scoreCandidate(
      candidate.quad,
      gray,
      gradient.magnitude,
      gradient.threshold,
      width,
      height,
    );
    if (metrics && (!best || metrics.score > best.metrics.score))
      best = { ...candidate, metrics };
  }
  const confidence = best?.metrics.confidence ?? 0;
  const minimum = clamp(
    Number.isFinite(options.minConfidence)
      ? options.minConfidence!
      : DEFAULT_MIN_CONFIDENCE,
    0.15,
    0.95,
  );
  if (!best || confidence < minimum || best.metrics.edgeSupport < 0.28)
    return {
      corners: null,
      confidence,
      diagnostics: diagnostics(
        started,
        confidence,
        unique.size,
        gradient.threshold,
        edges.density,
        best?.metrics,
        best ? "low-confidence" : "no-candidate",
      ),
    };
  return {
    corners: best.quad,
    confidence,
    diagnostics: {
      ...diagnostics(
        started,
        confidence,
        unique.size,
        gradient.threshold,
        edges.density,
        best.metrics,
      ),
      source: best.source,
    },
  };
}
