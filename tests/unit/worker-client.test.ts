import { afterEach, describe, expect, it, vi } from "vitest";
import { WorkerClient } from "../../packages/scanfit/src/core/worker-client";

describe("worker failure lifecycle", () => {
  afterEach(() => vi.unstubAllGlobals());
  it("rejects a failed worker and creates a fresh worker for retry", async () => {
    const workers: any[] = [];
    class FakeWorker {
      onmessage: any;
      onerror: any;
      terminate = vi.fn();
      postMessage(message: any) {
        queueMicrotask(() =>
          workers.length === 1
            ? this.onerror()
            : this.onmessage({ data: { id: message.id, result: "recovered" } }),
        );
      }
      constructor() {
        workers.push(this);
      }
    }
    vi.stubGlobal("Worker", FakeWorker);
    vi.stubGlobal("location", {
      href: "https://example.test/",
      origin: "https://example.test",
    });
    const client = new WorkerClient("/worker.js");
    const task = {
      kind: "export" as const,
      pages: [],
      options: { maxBytes: 1000 },
    };
    await expect(client.run(task)).rejects.toMatchObject({
      code: "PROCESSING_FAILED",
    });
    await expect(client.run(task)).resolves.toBe("recovered");
    expect(workers[0].terminate).toHaveBeenCalledOnce();
    client.reset();
  });
});
