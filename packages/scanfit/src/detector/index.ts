import { Scanner } from "scanic";
import { validateQuad } from "../core/geometry";
import type { DocumentDetector, Quad } from "../core/types";
export type { DocumentDetector, DetectionResult } from "../core/types";

/** Classical-only adapter. No ML models or CDN requests are enabled. */
export function createDetector(): DocumentDetector {
  const scanner = new Scanner({
    mode: "detect",
    maxProcessingDimension: 800,
    detector: "classical",
  });
  return {
    async detect(image) {
      const result = await scanner.scan(image, {
        mode: "detect",
        detector: "classical",
      });
      // Scanic can return a best-effort outline even when its candidate was weak.
      if (!result.success || !result.corners || (result.confidence ?? 0) < 0.4)
        return { corners: null };
      const c = result.corners;
      const corners = [c.topLeft, c.topRight, c.bottomRight, c.bottomLeft].map(
        (p) => ({
          x: Math.max(0, Math.min(1, p.x / image.width)),
          y: Math.max(0, Math.min(1, p.y / image.height)),
        }),
      ) as Quad;
      try {
        validateQuad(corners);
      } catch {
        return { corners: null };
      }
      return { corners, confidence: result.confidence ?? undefined };
    },
  };
}
