export { createScanSession, FULL_QUAD } from "../../packages/scanfit/src/core";
export { createSample } from "../../playground/samples";

export async function detectorSample() {
  const canvas = document.createElement("canvas");
  canvas.width = 640;
  canvas.height = 480;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#303943";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  // Distractors stay separate from the page and exercise candidate ranking.
  ctx.fillStyle = "#66717c";
  ctx.fillRect(18, 25, 34, 170);
  ctx.fillRect(535, 420, 90, 14);
  const expected = [
    { x: 0.16, y: 0.12 },
    { x: 0.86, y: 0.2 },
    { x: 0.78, y: 0.9 },
    { x: 0.1, y: 0.8 },
  ];
  const path = (offsetX: number, offsetY: number) => {
    ctx.beginPath();
    expected.forEach((point, index) => {
      const x = point.x * (canvas.width - 1) + offsetX,
        y = point.y * (canvas.height - 1) + offsetY;
      if (index) ctx.lineTo(x, y);
      else ctx.moveTo(x, y);
    });
    ctx.closePath();
  };
  path(12, 15);
  ctx.fillStyle = "rgba(0,0,0,.32)";
  ctx.fill();
  path(0, 0);
  ctx.fillStyle = "#f5f2e9";
  ctx.fill();
  ctx.save();
  path(0, 0);
  ctx.clip();
  ctx.fillStyle = "#44505b";
  for (let y = 150; y <= 360; y += 34) ctx.fillRect(190, y, 260, 7);
  ctx.restore();
  const blob = await new Promise<Blob>((resolve) =>
    canvas.toBlob((value) => resolve(value!), "image/png"),
  );
  canvas.width = canvas.height = 0;
  return { blob, expected };
}

export async function coloredImage(
  orientation = 1,
  transparent = false,
): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = 160;
  canvas.height = 100;
  const ctx = canvas.getContext("2d")!;
  ["#ff0000", "#00ff00", "#0000ff", "#ffff00"].forEach((color, i) => {
    ctx.fillStyle = color;
    ctx.fillRect((i % 2) * 80, Math.floor(i / 2) * 50, 80, 50);
  });
  if (transparent) ctx.clearRect(0, 0, 80, 50);
  const blob = await new Promise<Blob>((resolve) =>
    canvas.toBlob(
      (b) => resolve(b!),
      transparent ? "image/png" : "image/jpeg",
      0.98,
    ),
  );
  canvas.width = canvas.height = 0;
  if (transparent) return blob;
  const original = new Uint8Array(await blob.arrayBuffer());
  const exif = new Uint8Array([
    255,
    225,
    0,
    34,
    69,
    120,
    105,
    102,
    0,
    0,
    73,
    73,
    42,
    0,
    8,
    0,
    0,
    0,
    1,
    0,
    18,
    1,
    3,
    0,
    1,
    0,
    0,
    0,
    orientation,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
  ]);
  return new Blob([original.slice(0, 2), exif, original.slice(2)], {
    type: "image/jpeg",
  });
}
export async function pixel(blob: Blob, x = 10, y = 10) {
  const bmp = await createImageBitmap(blob),
    canvas = new OffscreenCanvas(bmp.width, bmp.height),
    ctx = canvas.getContext("2d")!;
  ctx.drawImage(bmp, 0, 0);
  bmp.close();
  const rgba = Array.from(ctx.getImageData(x, y, 1, 1).data);
  canvas.width = canvas.height = 0;
  return rgba;
}
export async function validatePdf(data: Uint8Array) {
  const modulePath = "/node_modules/pdfjs-dist/build/pdf.mjs";
  const pdfjs = await import(/* @vite-ignore */ modulePath);
  pdfjs.GlobalWorkerOptions.workerSrc =
    "/node_modules/pdfjs-dist/build/pdf.worker.mjs";
  const loading = pdfjs.getDocument({ data, isEvalSupported: false });
  const doc = await loading.promise;
  const pages = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i),
      viewport = page.getViewport({ scale: 0.7 }),
      canvas = document.createElement("canvas");
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    const ctx = canvas.getContext("2d")!;
    await page.render({ canvas, canvasContext: ctx, viewport }).promise;
    const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    let ink = 0;
    for (let j = 0; j < pixels.length; j += 4)
      if (Math.min(pixels[j], pixels[j + 1], pixels[j + 2]) < 200) ink++;
    pages.push({ width: viewport.width, height: viewport.height, ink });
    canvas.width = canvas.height = 0;
    page.cleanup();
  }
  const metadata = await doc.getMetadata();
  await loading.destroy();
  return { pages, metadata: metadata.info };
}
