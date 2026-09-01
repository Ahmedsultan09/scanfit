import {
  detectDocument,
  type ClassicalDetectorOptions,
} from "./scanfit-classical";
import type { DocumentDetector } from "../core/types";

export type {
  DetectionDiagnostics,
  DetectionResult,
  DocumentDetector,
} from "../core/types";
export type { ClassicalDetectorOptions } from "./scanfit-classical";

/**
 * Scanfit's independent, worker-safe classical detector.
 *
 * The implementation uses standard image-processing techniques over typed
 * arrays and contains no Scanic source or derived code.
 */
export function createDetector(
  options: ClassicalDetectorOptions = {},
): DocumentDetector {
  return {
    async detect(image) {
      return detectDocument(image, options);
    },
  };
}
