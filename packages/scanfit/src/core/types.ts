export interface Point {
  x: number;
  y: number;
}
/** Clockwise TL, TR, BR, BL, normalized in the oriented source image. */
export type Quad = [Point, Point, Point, Point];
export type Filter = "natural" | "grayscale" | "contrast";
export type Warning =
  | "manual-crop"
  | "detection-unavailable"
  | "possibly-blurry"
  | "possibly-dark"
  | "low-resolution";
export interface PageEdits {
  corners: Quad;
  rotation: 0 | 90 | 180 | 270;
  filter: Filter;
}
export interface ScanPage {
  id: string;
  width: number;
  height: number;
  sourceBytes: number;
  preview: Blob;
  thumbnail: Blob;
  edits: PageEdits;
  warnings: Warning[];
}
export interface StoredPage extends ScanPage {
  source: Blob;
}
export interface DetectionResult {
  corners: Quad | null;
  confidence?: number;
}
export interface DocumentDetector {
  detect(image: ImageData): Promise<DetectionResult>;
}
export interface SafetyLimits {
  maxPages: number;
  maxFileBytes: number;
  maxPixels: number;
  maxSessionBytes: number;
}
export interface SessionOptions {
  limits?: Partial<SafetyLimits>;
  detector?: "auto" | "none";
  /** Optional same-origin ES module exporting createDetector(): DocumentDetector. */
  detectorModule?: string;
  /** For hosts with a custom worker asset pipeline. Must be same-origin. */
  workerUrl?: string;
}
export type PageSize = "a4" | "letter" | "image";
export interface ExportOptions {
  maxBytes: number;
  pageSize?: PageSize;
  minQuality?: number;
  minLongEdge?: number;
  signal?: AbortSignal;
}
export interface PageReport {
  id: string;
  imageBytes: number;
  width: number;
  height: number;
  quality: number;
  attempts: number;
  warnings: Warning[];
  preview: Blob;
}
export interface ExportReport {
  bytes: number;
  maxBytes: number;
  pageSize: PageSize;
  pages: PageReport[];
  limits: { minQuality: number; minLongEdge: number; maxEncodesPerPage: 12 };
}
export type ExportResult =
  | { status: "ready"; file: File; report: ExportReport }
  | { status: "cannot-fit"; candidateBytes: number; report: ExportReport }
  | { status: "cancelled" };
export interface ScanSnapshot {
  pages: readonly ScanPage[];
  status: "idle" | "importing" | "exporting";
  progress: number;
  result: ExportResult | null;
  error: ScanError | null;
}
export type ErrorCode =
  | "INVALID_INPUT"
  | "UNSUPPORTED_FORMAT"
  | "LIMIT_EXCEEDED"
  | "INVALID_CORNERS"
  | "PROCESSING_FAILED"
  | "UNSUPPORTED_BROWSER"
  | "DISPOSED"
  | "CAMERA_UNAVAILABLE";
export class ScanError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "ScanError";
  }
}
export const DEFAULT_LIMITS: SafetyLimits = Object.freeze({
  maxPages: 20,
  maxFileBytes: 25 * 1024 ** 2,
  maxPixels: 25_000_000,
  maxSessionBytes: 100 * 1024 ** 2,
});
export const FULL_QUAD: Quad = [
  { x: 0, y: 0 },
  { x: 1, y: 0 },
  { x: 1, y: 1 },
  { x: 0, y: 1 },
];
export const copyQuad = (q: Quad): Quad => q.map((p) => ({ ...p })) as Quad;
export function abortIfNeeded(signal?: AbortSignal) {
  if (signal?.aborted)
    throw new DOMException("Operation cancelled", "AbortError");
}
export function asScanError(error: unknown): ScanError {
  return error instanceof ScanError
    ? error
    : new ScanError(
        "PROCESSING_FAILED",
        error instanceof Error
          ? error.message
          : "Document processing failed. Please try again.",
      );
}
