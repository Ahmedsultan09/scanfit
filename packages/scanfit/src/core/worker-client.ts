import { canvasBridge } from "./canvas-bridge";
import { ScanError, abortIfNeeded } from "./types";
import type { WorkerTask } from "./protocol";
import ProcessingWorker from "./processor.worker?worker";

export class WorkerClient {
  private worker: Worker | null = null;
  private sequence = 0;
  private generation = 0;
  private tail: Promise<unknown> = Promise.resolve();
  private pending = new Map<
    number,
    {
      resolve: (value: any) => void;
      reject: (error: unknown) => void;
      progress?: (p: number) => void;
    }
  >();
  constructor(private url?: string) {}
  private ensure() {
    if (this.worker) return this.worker;
    if (typeof Worker === "undefined")
      throw new ScanError(
        "UNSUPPORTED_BROWSER",
        "This browser does not support processing workers.",
      );
    if (this.url && new URL(this.url, location.href).origin !== location.origin)
      throw new ScanError(
        "INVALID_INPUT",
        "The processing worker must be served from the same origin.",
      );
    const worker = this.url
      ? new Worker(this.url, { type: "module" })
      : new ProcessingWorker({ name: "scanfit-processing" });
    this.worker = worker;
    worker.onmessage = async (event) => {
      const m = event.data;
      if (m.type === "bridge") {
        try {
          const result = await canvasBridge(m.action);
          if (this.worker === worker)
            worker.postMessage(
              { type: "bridge-result", id: m.id, result },
              "buffer" in result ? [result.buffer as ArrayBuffer] : [],
            );
        } catch (error) {
          if (this.worker === worker)
            worker.postMessage({
              type: "bridge-result",
              id: m.id,
              error:
                error instanceof Error
                  ? error.message
                  : "Canvas bridge failed.",
            });
        }
        return;
      }
      const task = this.pending.get(m.id);
      if (!task) return;
      if (m.type === "progress") {
        task.progress?.(m.value);
        return;
      }
      this.pending.delete(m.id);
      if (m.error)
        task.reject(
          new ScanError(m.error.code ?? "PROCESSING_FAILED", m.error.message),
        );
      else task.resolve(m.result);
    };
    worker.onerror = () =>
      this.reset(
        new ScanError(
          "PROCESSING_FAILED",
          "The processing worker failed. Check worker/WASM permissions and try again.",
        ),
      );
    worker.onmessageerror = () =>
      this.reset(
        new ScanError(
          "PROCESSING_FAILED",
          "Could not read the worker response.",
        ),
      );
    return worker;
  }
  run<T>(
    task: WorkerTask,
    signal?: AbortSignal,
    progress?: (p: number) => void,
  ): Promise<T> {
    const generation = this.generation;
    const execute = async () => {
      abortIfNeeded(signal);
      if (generation !== this.generation)
        throw new DOMException("Operation cancelled", "AbortError");
      const worker = this.ensure(),
        id = ++this.sequence;
      let timer: ReturnType<typeof setTimeout>;
      const abort = () =>
        this.reset(new DOMException("Operation cancelled", "AbortError"));
      try {
        return await new Promise<T>((resolve, reject) => {
          this.pending.set(id, { resolve, reject, progress });
          signal?.addEventListener("abort", abort, { once: true });
          timer = setTimeout(
            () =>
              this.reset(
                new ScanError(
                  "PROCESSING_FAILED",
                  "Processing timed out. Try fewer or smaller pages.",
                ),
              ),
            120_000,
          );
          try {
            worker.postMessage({ id, task });
          } catch (error) {
            this.pending.delete(id);
            reject(error);
          }
        });
      } finally {
        clearTimeout(timer!);
        signal?.removeEventListener("abort", abort);
      }
    };
    const result = this.tail.then(execute, execute);
    this.tail = result.catch(() => {});
    return result;
  }
  reset(
    error: unknown = new DOMException("Operation cancelled", "AbortError"),
  ) {
    this.generation++;
    this.worker?.terminate();
    this.worker = null;
    for (const p of this.pending.values()) p.reject(error);
    this.pending.clear();
  }
}
