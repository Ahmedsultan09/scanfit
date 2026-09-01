import { createDetector } from "../detector";
import { fitPdf } from "../pdf";
import { fitDimensions, warpPixels } from "./geometry";
import {
  FULL_QUAD,
  copyQuad,
  type DocumentDetector,
  type StoredPage,
  type Warning,
  type Quad,
} from "./types";
import type { BridgeAction, WorkerTask } from "./protocol";
import { inspectImageBytes, type ImageHeader } from "./headers";

const scope = self as unknown as {
  postMessage: (message: unknown, transfer?: Transferable[]) => void;
  onmessage: ((event: MessageEvent) => void) | null;
};
let bridgeId = 0;
const bridges = new Map<
  number,
  { resolve: (value: any) => void; reject: (error: Error) => void }
>();
function bridge(action: BridgeAction): Promise<any> {
  return new Promise((resolve, reject) => {
    const id = ++bridgeId;
    bridges.set(id, { resolve, reject });
    scope.postMessage(
      { type: "bridge", id, action },
      action.kind === "encode" ? [action.buffer] : [],
    );
  });
}
let detector: DocumentDetector | undefined, detectorKey: string | undefined;

async function decode(
  blob: Blob,
  header: Pick<ImageHeader, "width" | "height" | "orientation">,
  longEdge = 2400,
  region?: { x: number; y: number; width: number; height: number },
): Promise<ImageData> {
  const swap = header.orientation >= 5,
    dims = fitDimensions(
      region?.width ?? (swap ? header.height : header.width),
      region?.height ?? (swap ? header.width : header.height),
      longEdge,
    );
  if (
    typeof OffscreenCanvas !== "undefined" &&
    typeof createImageBitmap === "function"
  ) {
    let bitmap: ImageBitmap | undefined, canvas: OffscreenCanvas | undefined;
    try {
      const settings: ImageBitmapOptions = {
        imageOrientation: "from-image",
        resizeWidth: dims.width,
        resizeHeight: dims.height,
        resizeQuality: "high",
      };
      bitmap = region
        ? await createImageBitmap(
            blob,
            region.x,
            region.y,
            region.width,
            region.height,
            settings,
          )
        : await createImageBitmap(blob, settings);
      canvas = new OffscreenCanvas(dims.width, dims.height);
      const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
      ctx.drawImage(bitmap, 0, 0, dims.width, dims.height);
      return ctx.getImageData(0, 0, dims.width, dims.height);
    } catch {
      /* Use native main-thread decoding when worker codecs are unavailable. */
    } finally {
      bitmap?.close();
      if (canvas) canvas.width = canvas.height = 0;
    }
  }
  const result = await bridge({ kind: "decode", blob, ...dims, region });
  return new ImageData(
    new Uint8ClampedArray(result.buffer),
    result.width,
    result.height,
  );
}

async function encode(
  pixels: ImageData,
  longEdge: number,
  quality: number,
): Promise<{ blob: Blob; width: number; height: number }> {
  const dims = fitDimensions(pixels.width, pixels.height, longEdge);
  if (typeof OffscreenCanvas !== "undefined") {
    const canvas = new OffscreenCanvas(pixels.width, pixels.height),
      target = new OffscreenCanvas(dims.width, dims.height);
    try {
      canvas.getContext("2d")!.putImageData(pixels, 0, 0);
      const ctx = target.getContext("2d")!;
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, target.width, target.height);
      ctx.drawImage(canvas, 0, 0, target.width, target.height);
      const blob = await target.convertToBlob({ type: "image/jpeg", quality });
      if (blob.type === "image/jpeg") return { blob, ...dims };
    } catch {
      /* Native main-thread JPEG encoder is the fallback. */
    } finally {
      canvas.width = canvas.height = target.width = target.height = 0;
    }
  }
  return bridge({
    kind: "encode",
    buffer: pixels.data.slice().buffer,
    width: pixels.width,
    height: pixels.height,
    quality,
    longEdge,
  });
}

function warnings(pixels: ImageData): Warning[] {
  const { width: w, height: h, data: d } = pixels;
  let sum = 0,
    lap = 0,
    count = 0;
  const gray = (i: number) =>
    0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
  for (let y = 1; y < h - 1; y += 3)
    for (let x = 1; x < w - 1; x += 3) {
      const i = (y * w + x) * 4,
        g = gray(i);
      sum += g;
      const l =
        gray(i - 4) + gray(i + 4) + gray(i - w * 4) + gray(i + w * 4) - 4 * g;
      lap += l * l;
      count++;
    }
  const result: Warning[] = [];
  if (count && sum / count < 55) result.push("possibly-dark");
  if (count && lap / count < 12) result.push("possibly-blurry");
  return result;
}

async function render(page: StoredPage) {
  // Source bytes retain EXIF. Dimensions stored on the page are already oriented.
  const header = inspectImageBytes(
    new Uint8Array(await page.source.arrayBuffer()),
  );
  // Crop the native source's bounding region BEFORE reducing resolution. Otherwise a small
  // crop within a large photo would be needlessly downsampled below the quality floor.
  const points = page.edits.corners.map((p) => ({
    x: p.x * (page.width - 1),
    y: p.y * (page.height - 1),
  }));
  const x = Math.floor(Math.min(...points.map((p) => p.x))),
    y = Math.floor(Math.min(...points.map((p) => p.y)));
  const region = {
    x,
    y,
    width: Math.ceil(Math.max(...points.map((p) => p.x))) - x + 1,
    height: Math.ceil(Math.max(...points.map((p) => p.y))) - y + 1,
  };
  const corners = points.map((p) => ({
    x: (p.x - x) / Math.max(1, region.width - 1),
    y: (p.y - y) / Math.max(1, region.height - 1),
  })) as Quad;
  return warpPixels(await decode(page.source, header, 2400, region), {
    ...page.edits,
    corners,
  });
}

async function processTask(task: WorkerTask, id: number): Promise<unknown> {
  if (task.kind === "analyze") {
    const pixels = await decode(task.blob, task.header, 1200),
      analysis = await decode(task.blob, task.header, 800);
    let corners = copyQuad(FULL_QUAD);
    const flags = warnings(analysis);
    if (task.options.detector !== "none") {
      try {
        if (
          !task.options.detectorModule &&
          typeof OffscreenCanvas === "undefined"
        )
          throw new Error("Worker canvas unavailable.");
        if (!detector || detectorKey !== task.options.detectorModule) {
          detector = task.options.detectorModule
            ? await (
                await import(/* @vite-ignore */ task.options.detectorModule)
              ).createDetector()
            : createDetector();
          detectorKey = task.options.detectorModule;
        }
        const result = await detector!.detect(analysis);
        if (result.corners) corners = result.corners;
        else flags.push("manual-crop");
      } catch {
        flags.push("detection-unavailable", "manual-crop");
      }
    } else flags.push("manual-crop");
    const preview = await encode(pixels, 1200, 0.88),
      thumbnail = await encode(pixels, 256, 0.75);
    const swap = task.header.orientation >= 5;
    const width = swap ? task.header.height : task.header.width,
      height = swap ? task.header.width : task.header.height;
    if (Math.max(width, height) < 1600) flags.push("low-resolution");
    return {
      preview: preview.blob,
      thumbnail: thumbnail.blob,
      width,
      height,
      corners,
      warnings: flags,
    };
  }
  if (task.kind === "render")
    return (await encode(await render(task.page), 1200, 0.88)).blob;
  let cachedIndex = -1,
    cached: ImageData | null = null;
  try {
    return await fitPdf(
      task.pages,
      {
        async encode(index, longEdge, quality) {
          if (cachedIndex !== index) {
            cached = null;
            cached = await render(task.pages[index]);
            cachedIndex = index;
          }
          const result = await encode(cached!, longEdge, quality),
            page = task.pages[index];
          return {
            id: page.id,
            jpeg: result.blob,
            width: result.width,
            height: result.height,
            quality,
            warnings: page.warnings,
          };
        },
      },
      task.options,
      (value) => scope.postMessage({ type: "progress", id, value }),
    );
  } finally {
    cached = null;
  }
}

scope.onmessage = (event) => {
  const m = event.data;
  if (m.type === "bridge-result") {
    const b = bridges.get(m.id);
    if (b) {
      bridges.delete(m.id);
      m.error ? b.reject(new Error(m.error)) : b.resolve(m.result);
    }
    return;
  }
  void processTask(m.task, m.id)
    .then((result) => scope.postMessage({ id: m.id, result }))
    .catch((error) =>
      scope.postMessage({
        id: m.id,
        error: {
          code: error.code ?? "PROCESSING_FAILED",
          message: error.message ?? "Document processing failed.",
        },
      }),
    );
};
