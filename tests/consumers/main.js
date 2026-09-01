import { createScanSession } from "@scanfit/browser/core";
import { createElement } from "react";
import { createRoot } from "react-dom/client";
import { ScannerTrigger } from "@scanfit/browser/trigger";
import "@scanfit/browser/styles.css";

// Exported fixture deliberately consumes the packaged files, never library source.
window.runScanFitFixture = async () => {
  const c = document.createElement("canvas");
  c.width = 400;
  c.height = 600;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "white";
  ctx.fillRect(0, 0, 400, 600);
  ctx.fillStyle = "black";
  ctx.font = "24px sans-serif";
  ctx.fillText("Packaged consumer fixture", 12, 150);
  const blob = await new Promise((resolve) => c.toBlob(resolve, "image/png"));
  c.width = c.height = 0;
  const session = createScanSession();
  try {
    await session.addFiles([blob]);
    const result = await session.exportPdf({ maxBytes: 100_000 });
    return {
      status: result.status,
      bytes: result.status === "ready" ? result.file.size : 0,
      pages: session.getSnapshot().pages.length,
      warnings: session.getSnapshot().pages[0].warnings,
    };
  } finally {
    session.dispose();
  }
};
createRoot(document.getElementById("root")).render(
  createElement(
    ScannerTrigger,
    { maxBytes: 100_000, onComplete: () => {} },
    "Open scanner",
  ),
);
