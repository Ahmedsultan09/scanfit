import { ScanError } from "./types";
import { fitDimensions } from "./geometry";
import type { BridgeAction } from "./protocol";
import { stripJpegApp1 } from "./jpeg";

/** Native canvas decode/encode only. Pixel transforms never run in this bridge. */
export async function canvasBridge(action: BridgeAction) {
  const canvas = document.createElement("canvas");
  let bitmap: ImageBitmap | undefined, url: string | undefined;
  try {
    if (action.kind === "decode") {
      canvas.width = action.width;
      canvas.height = action.height;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx)
        throw new ScanError("UNSUPPORTED_BROWSER", "A 2D canvas is required.");
      if (typeof createImageBitmap === "function") {
        try {
          const settings: ImageBitmapOptions = {
              imageOrientation: "from-image",
              resizeWidth: action.width,
              resizeHeight: action.height,
              resizeQuality: "high",
            },
            r = action.region;
          bitmap = r
            ? await createImageBitmap(
                action.blob,
                r.x,
                r.y,
                r.width,
                r.height,
                settings,
              )
            : await createImageBitmap(action.blob, settings);
        } catch {
          /* Try the native image element decoder. */
        }
      }
      if (bitmap) ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      else {
        url = URL.createObjectURL(action.blob);
        const image = new Image();
        image.src = url;
        await image.decode();
        const r = action.region;
        if (r)
          ctx.drawImage(
            image,
            r.x,
            r.y,
            r.width,
            r.height,
            0,
            0,
            canvas.width,
            canvas.height,
          );
        else ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
        image.src = "";
      }
      const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
      return {
        buffer: pixels.data.buffer,
        width: pixels.width,
        height: pixels.height,
      };
    }
    const dims = fitDimensions(action.width, action.height, action.longEdge);
    canvas.width = action.width;
    canvas.height = action.height;
    const ctx = canvas.getContext("2d");
    if (!ctx)
      throw new ScanError("UNSUPPORTED_BROWSER", "A 2D canvas is required.");
    ctx.putImageData(
      new ImageData(
        new Uint8ClampedArray(action.buffer),
        action.width,
        action.height,
      ),
      0,
      0,
    );
    const target = document.createElement("canvas");
    target.width = dims.width;
    target.height = dims.height;
    try {
      const targetCtx = target.getContext("2d")!;
      targetCtx.fillStyle = "#fff";
      targetCtx.fillRect(0, 0, target.width, target.height);
      targetCtx.drawImage(canvas, 0, 0, target.width, target.height);
      const blob = await new Promise<Blob>((resolve, reject) =>
        target.toBlob(
          (b) => (b ? resolve(b) : reject(new Error("JPEG encoding failed."))),
          "image/jpeg",
          action.quality,
        ),
      );
      if (blob.type !== "image/jpeg")
        throw new ScanError(
          "UNSUPPORTED_BROWSER",
          "This browser cannot encode JPEG images.",
        );
      return { blob: await stripJpegApp1(blob), ...dims };
    } finally {
      target.width = target.height = 0;
    }
  } finally {
    bitmap?.close();
    if (url) URL.revokeObjectURL(url);
    canvas.width = canvas.height = 0;
  }
}
