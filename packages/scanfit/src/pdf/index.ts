import { pdf } from "tinypdf";
import {
  ScanError,
  abortIfNeeded,
  type ExportOptions,
  type ExportReport,
  type PageReport,
  type PageSize,
  type Warning,
} from "../core/types";

export interface EncodedPage {
  id: string;
  jpeg: Blob;
  width: number;
  height: number;
  quality: number;
  warnings: Warning[];
}
export interface PdfPageSource {
  id: string;
  warnings: Warning[];
}
export interface PdfEncoder {
  encode(
    index: number,
    longEdge: number,
    quality: number,
  ): Promise<EncodedPage>;
}
export interface PdfFitResult {
  status: "ready" | "cannot-fit";
  blob: Blob;
  report: ExportReport;
}

export function validateExportOptions(options: ExportOptions) {
  if (!Number.isSafeInteger(options.maxBytes) || options.maxBytes < 1)
    throw new ScanError(
      "INVALID_INPUT",
      "maxBytes must be a positive integer number of bytes.",
    );
  const q = options.minQuality ?? 0.65,
    edge = options.minLongEdge ?? 1600;
  if (!Number.isFinite(q) || q < 0.1 || q > 0.9)
    throw new ScanError(
      "INVALID_INPUT",
      "minQuality must be between 0.1 and 0.9.",
    );
  if (!Number.isSafeInteger(edge) || edge < 128 || edge > 2400)
    throw new ScanError(
      "INVALID_INPUT",
      "minLongEdge must be an integer between 128 and 2400.",
    );
  if (options.pageSize && !["a4", "letter", "image"].includes(options.pageSize))
    throw new ScanError("INVALID_INPUT", "Unknown PDF page size.");
}

export async function buildPdf(
  pages: readonly EncodedPage[],
  pageSize: PageSize = "a4",
): Promise<Blob> {
  if (!pages.length)
    throw new ScanError(
      "INVALID_INPUT",
      "Add at least one page before exporting.",
    );
  const doc = pdf();
  for (const page of pages) {
    const bytes = new Uint8Array(await page.jpeg.arrayBuffer());
    if (
      page.jpeg.type !== "image/jpeg" ||
      bytes[0] !== 0xff ||
      bytes[1] !== 0xd8
    )
      throw new ScanError(
        "PROCESSING_FAILED",
        "The browser did not produce a valid JPEG.",
      );
    const dims =
      pageSize === "a4"
        ? [595.28, 841.89]
        : pageSize === "letter"
          ? [612, 792]
          : [page.width * 0.75, page.height * 0.75];
    const scale = Math.min(dims[0] / page.width, dims[1] / page.height),
      w = page.width * scale,
      h = page.height * scale;
    doc.page(dims[0], dims[1], (ctx) =>
      ctx.image(bytes, (dims[0] - w) / 2, (dims[1] - h) / 2, w, h),
    );
  }
  // Streaming avoids the writer's additional concatenated Uint8Array allocation.
  return new Response(doc.buildStream(), {
    headers: { "Content-Type": "application/pdf" },
  }).blob();
}

/** Bounded, measured search. A cannot-fit result is not a mathematical impossibility proof. */
export async function fitPdf(
  sources: readonly PdfPageSource[],
  encoder: PdfEncoder,
  options: ExportOptions,
  progress?: (value: number) => void,
): Promise<PdfFitResult> {
  validateExportOptions(options);
  if (!sources.length)
    throw new ScanError(
      "INVALID_INPUT",
      "Add at least one page before exporting.",
    );
  const attempts = sources.map(() => 0),
    pageSize = options.pageSize ?? "a4";
  const encode = async (i: number, edge: number, q: number) => {
    abortIfNeeded(options.signal);
    if (attempts[i] >= 12)
      throw new ScanError(
        "PROCESSING_FAILED",
        "Encoding attempt limit reached.",
      );
    attempts[i]++;
    const result = await encoder.encode(i, edge, q);
    abortIfNeeded(options.signal);
    return result;
  };
  const chosen: EncodedPage[] = [];
  for (let i = 0; i < sources.length; i++) {
    chosen.push(await encode(i, 2400, 0.9));
    progress?.(((i + 1) / sources.length) * 0.35);
  }
  let output = await buildPdf(chosen, pageSize);
  abortIfNeeded(options.signal);
  if (output.size > options.maxBytes) {
    const weights = chosen.map((p) => p.jpeg.size);
    // Reserve extra room for changed decimal lengths in PDF offsets/dimensions.
    let pool = Math.max(
      0,
      options.maxBytes -
        (output.size - weights.reduce((a, b) => a + b, 0)) -
        1024,
    );
    let remainingWeight = weights.reduce((a, b) => a + b, 0);
    const qualityFloor = options.minQuality ?? 0.65;
    const qualities = [
      ...new Set(
        [0.9, 0.8, 0.7, qualityFloor].filter((q) => q >= qualityFloor),
      ),
    ];
    for (let i = 0; i < sources.length; i++) {
      const share = Math.max(
        0,
        Math.floor((pool * weights[i]) / remainingWeight),
      );
      const base = chosen[i],
        nativeEdge = Math.max(base.width, base.height),
        floor = Math.min(nativeEdge, options.minLongEdge ?? 1600);
      const edges = [
        ...new Set([nativeEdge, Math.round((nativeEdge + floor) / 2), floor]),
      ];
      let best = base,
        found = base.jpeg.size <= share;
      outer: for (const edge of edges)
        for (const quality of qualities) {
          if (found) break outer;
          if (edge === nativeEdge && quality === 0.9) continue;
          const candidate = await encode(i, edge, quality);
          if (candidate.jpeg.size < best.jpeg.size) best = candidate;
          if (candidate.jpeg.size <= share) {
            best = candidate;
            found = true;
            break outer;
          }
        }
      chosen[i] = best;
      pool -= best.jpeg.size;
      remainingWeight -= weights[i];
      progress?.(0.35 + ((i + 1) / sources.length) * 0.6);
    }
    output = await buildPdf(chosen, pageSize);
  }
  abortIfNeeded(options.signal);
  const report: ExportReport = {
    bytes: output.size,
    maxBytes: options.maxBytes,
    pageSize,
    limits: {
      minQuality: options.minQuality ?? 0.65,
      minLongEdge: options.minLongEdge ?? 1600,
      maxEncodesPerPage: 12,
    },
    pages: chosen.map(
      (p, i): PageReport => ({
        id: p.id,
        imageBytes: p.jpeg.size,
        width: p.width,
        height: p.height,
        quality: p.quality,
        attempts: attempts[i],
        warnings: p.warnings,
        preview: p.jpeg,
      }),
    ),
  };
  progress?.(1);
  return {
    status: output.size <= options.maxBytes ? "ready" : "cannot-fit",
    blob: output,
    report,
  };
}
