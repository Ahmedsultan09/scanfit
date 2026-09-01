import { inspectImage } from "./headers";
import { validateQuad } from "./geometry";
import { WorkerClient } from "./worker-client";
import {
  DEFAULT_LIMITS,
  ScanError,
  asScanError,
  abortIfNeeded,
  copyQuad,
  type ExportOptions,
  type ExportResult,
  type PageEdits,
  type ScanPage,
  type ScanSnapshot,
  type SessionOptions,
  type StoredPage,
  type Quad,
  type Warning,
} from "./types";
import type { PdfFitResult } from "../pdf";
export * from "./types";
export { inspectImageBytes } from "./headers";
export { validateQuad } from "./geometry";

export interface ScanSession {
  getSnapshot(): ScanSnapshot;
  subscribe(listener: () => void): () => void;
  addFiles(
    files: Iterable<Blob>,
    options?: { signal?: AbortSignal; replacePageId?: string },
  ): Promise<ScanPage[]>;
  updatePage(id: string, edits: Partial<PageEdits>): void;
  movePage(id: string, index: number): void;
  removePage(id: string): void;
  renderPage(id: string, signal?: AbortSignal): Promise<Blob>;
  exportPdf(options: ExportOptions): Promise<ExportResult>;
  cancel(): void;
  dispose(): void;
}

export function createScanSession(options: SessionOptions = {}): ScanSession {
  const limits = { ...DEFAULT_LIMITS, ...options.limits };
  if (Object.values(limits).some((n) => !Number.isSafeInteger(n) || n < 1))
    throw new ScanError(
      "INVALID_INPUT",
      "Safety limits must be positive integers.",
    );
  if (
    options.detectorModule &&
    (typeof location === "undefined" ||
      new URL(options.detectorModule, location.href).origin !== location.origin)
  )
    throw new ScanError(
      "INVALID_INPUT",
      "Detector modules must be served from the same origin.",
    );
  const detectorModule = options.detectorModule
    ? new URL(options.detectorModule, location.href).href
    : undefined;
  const client = new WorkerClient(options.workerUrl),
    listeners = new Set<() => void>();
  let pages: StoredPage[] = [],
    version = 0,
    disposed = false,
    active: AbortController | null = null;
  let snapshot: ScanSnapshot = {
    pages: [],
    status: "idle",
    progress: 0,
    result: null,
    error: null,
  };
  const assertAlive = () => {
    if (disposed)
      throw new ScanError("DISPOSED", "This scan session has been disposed.");
  };
  const publicPage = (p: StoredPage): ScanPage =>
    Object.freeze({
      id: p.id,
      width: p.width,
      height: p.height,
      sourceBytes: p.sourceBytes,
      preview: p.preview,
      thumbnail: p.thumbnail,
      warnings: Object.freeze([...p.warnings]) as unknown as Warning[],
      edits: Object.freeze({
        ...p.edits,
        corners: Object.freeze(
          copyQuad(p.edits.corners).map((p) => Object.freeze(p)),
        ) as unknown as Quad,
      }),
    });
  const emit = (patch: Partial<ScanSnapshot> = {}) => {
    if (disposed) return;
    snapshot = {
      ...snapshot,
      ...patch,
      pages: Object.freeze(pages.map(publicPage)),
    };
    for (const listener of listeners) listener();
  };
  const invalidate = () => {
    version++;
    active?.abort();
    active = null;
    emit({ status: "idle", progress: 0, result: null, error: null });
  };
  const pageById = (id: string) => {
    const p = pages.find((p) => p.id === id);
    if (!p) throw new ScanError("INVALID_INPUT", "This page no longer exists.");
    return p;
  };
  function begin(status: "importing" | "exporting", external?: AbortSignal) {
    assertAlive();
    invalidate();
    const token = version,
      controller = new AbortController();
    active = controller;
    const abort = () => controller.abort();
    external?.addEventListener("abort", abort, { once: true });
    if (external?.aborted) controller.abort();
    emit({ status });
    return {
      token,
      signal: controller.signal,
      finish() {
        external?.removeEventListener("abort", abort);
        if (active === controller) active = null;
        if (!disposed && version === token) emit({ status: "idle" });
      },
    };
  }
  function current(token: number, signal?: AbortSignal) {
    abortIfNeeded(signal);
    if (disposed || token !== version)
      throw new DOMException("Operation cancelled", "AbortError");
  }
  const session: ScanSession = {
    getSnapshot: () => snapshot,
    subscribe(listener) {
      assertAlive();
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    async addFiles(input, { signal, replacePageId } = {}) {
      const files = Array.from(input);
      assertAlive();
      if (!files.length) return [];
      const replaced = replacePageId ? pageById(replacePageId) : undefined;
      if (replaced && files.length !== 1)
        throw new ScanError("INVALID_INPUT", "Select one replacement photo.");
      if (files.length + pages.length - (replaced ? 1 : 0) > limits.maxPages)
        throw new ScanError(
          "LIMIT_EXCEEDED",
          `The session allows at most ${limits.maxPages} pages.`,
        );
      if (files.some((f) => !(f instanceof Blob)))
        throw new ScanError("INVALID_INPUT", "Expected image files or blobs.");
      if (
        files.reduce((n, f) => n + f.size, 0) +
          pages.reduce((n, p) => n + p.sourceBytes, 0) -
          (replaced?.sourceBytes ?? 0) >
        limits.maxSessionBytes
      )
        throw new ScanError(
          "LIMIT_EXCEEDED",
          "These photos exceed the session input limit. Choose fewer or smaller photos.",
        );
      const op = begin("importing", signal),
        accepted: ScanPage[] = [];
      try {
        for (const file of files) {
          current(op.token, op.signal);
          const header = await inspectImage(file, limits);
          current(op.token, op.signal);
          const data = await client.run<{
            preview: Blob;
            thumbnail: Blob;
            width: number;
            height: number;
            corners: Quad;
            warnings: Warning[];
          }>(
            {
              kind: "analyze",
              blob: file,
              header,
              options: { detector: options.detector, detectorModule },
            },
            op.signal,
          );
          current(op.token, op.signal);
          validateQuad(data.corners);
          const page: StoredPage = {
            id: replaced?.id ?? crypto.randomUUID(),
            source: file,
            sourceBytes: file.size,
            width: data.width,
            height: data.height,
            preview: data.preview,
            thumbnail: data.thumbnail,
            warnings: data.warnings,
            edits: {
              corners: copyQuad(data.corners),
              rotation: 0,
              filter: "natural",
            },
          };
          pages = replaced
            ? pages.map((p) => (p.id === replaced.id ? page : p))
            : [...pages, page];
          accepted.push(publicPage(page));
          emit({ progress: accepted.length / files.length });
        }
        return accepted;
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError")
          return accepted;
        const typed = asScanError(error);
        if (op.token === version) emit({ error: typed });
        throw typed;
      } finally {
        op.finish();
      }
    },
    updatePage(id, patch) {
      assertAlive();
      const old = pageById(id),
        edits = { ...old.edits, ...patch };
      validateQuad(edits.corners);
      if (
        ![0, 90, 180, 270].includes(edits.rotation) ||
        !["natural", "grayscale", "contrast"].includes(edits.filter)
      )
        throw new ScanError("INVALID_INPUT", "Invalid page edits.");
      invalidate();
      pages = pages.map((p) =>
        p.id === id
          ? { ...p, edits: { ...edits, corners: copyQuad(edits.corners) } }
          : p,
      );
      emit();
    },
    movePage(id, index) {
      assertAlive();
      const p = pageById(id);
      if (!Number.isInteger(index) || index < 0 || index >= pages.length)
        throw new ScanError("INVALID_INPUT", "Invalid page position.");
      invalidate();
      pages = pages.filter((p) => p.id !== id);
      pages.splice(index, 0, p);
      emit();
    },
    removePage(id) {
      assertAlive();
      pageById(id);
      invalidate();
      pages = pages.filter((p) => p.id !== id);
      emit();
    },
    async renderPage(id, signal) {
      assertAlive();
      const p = pageById(id),
        token = version;
      const blob = await client.run<Blob>({ kind: "render", page: p }, signal);
      current(token, signal);
      return blob;
    },
    async exportPdf(config) {
      assertAlive();
      if (!config || typeof config !== "object") throw new ScanError("INVALID_INPUT", "Provide export options with an explicit maxBytes limit.");
      if (!pages.length)
        throw new ScanError(
          "INVALID_INPUT",
          "Add at least one page before exporting.",
        );
      const op = begin("exporting", config.signal);
      try {
        const { signal: _, ...settings } = config;
        const data = await client.run<PdfFitResult>(
          { kind: "export", pages: [...pages], options: settings },
          op.signal,
          (value) => {
            if (op.token === version) emit({ progress: value });
          },
        );
        current(op.token, op.signal);
        // Independent client-side guard: never trust a worker success flag alone.
        const fits = data.blob.size <= config.maxBytes;
        const result: ExportResult = fits
          ? {
              status: "ready",
              file: new File([data.blob], "document.pdf", {
                type: "application/pdf",
              }),
              report: { ...data.report, bytes: data.blob.size },
            }
          : {
              status: "cannot-fit",
              candidateBytes: data.blob.size,
              report: data.report,
            };
        emit({ result, progress: 1 });
        return result;
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError")
          return { status: "cancelled" };
        const typed = asScanError(error);
        if (op.token === version) emit({ error: typed });
        throw typed;
      } finally {
        op.finish();
      }
    },
    cancel() {
      assertAlive();
      invalidate();
      client.reset();
    },
    dispose() {
      if (disposed) return;
      active?.abort();
      disposed = true;
      version++;
      client.reset();
      pages = [];
      snapshot = {
        pages: [],
        status: "idle",
        progress: 0,
        result: null,
        error: null,
      };
      listeners.clear();
    },
  };
  return session;
}
