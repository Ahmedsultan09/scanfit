import type { ImageHeader } from "./headers";
import type { SessionOptions, StoredPage, ExportOptions } from "./types";

export type WorkerTask =
  | {
      kind: "analyze";
      blob: Blob;
      header: ImageHeader;
      options: Pick<
        SessionOptions,
        "detector" | "detectorModule" | "detectorOptions"
      >;
    }
  | { kind: "render"; page: StoredPage }
  | {
      kind: "export";
      pages: StoredPage[];
      options: Omit<ExportOptions, "signal">;
    };
export type BridgeAction =
  | {
      kind: "decode";
      blob: Blob;
      width: number;
      height: number;
      region?: { x: number; y: number; width: number; height: number };
    }
  | {
      kind: "encode";
      buffer: ArrayBuffer;
      width: number;
      height: number;
      quality: number;
      longEdge: number;
    };
