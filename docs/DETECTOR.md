# Independent detector

Scanfit's default automatic document detector is implemented in this repository. It has no Scanic package, source, build hook, runtime loader or model dependency. `npm run test:independence` checks the package manifest, lockfile and emitted runtime on every verification run.

This is an independent implementation, not a formal legal clean-room process. Its source was written for Scanfit from the behavior described here and the repository's ground-truth tests. Do not introduce copied or mechanically translated detector code from another project. Contributions must identify any implementation source they adapt and confirm its license before review.

## Pipeline

The detector operates on the oriented image supplied by the processing worker, capped at an 800-pixel long edge. It uses deterministic typed-array code and browser-native `ImageData`; it performs no network request and ships no WASM or ML model.

1. Composite transparency onto white and calculate integer luminance.
2. Apply a small separable blur to suppress camera noise.
3. Calculate Sobel gradient magnitude and an image-adaptive high threshold.
4. Connect weak gradients to strong gradients with dual-threshold hysteresis.
5. Build bright, dark and border-contrast region maps using Otsu thresholding and robust border statistics.
6. Extract connected-region boundaries and reduce their convex hulls to quadrilateral candidates.
7. Independently use polar Hough voting to recover long boundary-line pairs when clutter joins otherwise useful components.
8. Normalize and validate clockwise, non-crossing quadrilaterals.
9. Score each candidate using measured boundary support, inside/outside contrast, coverage, corner geometry, side length and a soft image-border penalty.
10. Accept only candidates that cross both confidence and edge-support gates. Otherwise preserve the page and request manual cropping.

Sobel gradients, dual-threshold edge connectivity, Otsu thresholding, connected components, convex hulls and the Hough transform are established image-processing techniques. Scanfit's implementation, candidate construction, evidence mix, scoring and public diagnostics are its own code.

## Public evidence and tuning

Every analyzed `ScanPage` can expose `page.detection`:

```ts
interface DetectionDiagnostics {
  engine: string;
  confidence: number;
  candidateCount: number;
  edgeThreshold: number;
  edgeDensity: number;
  durationMs: number;
  coverage: number;
  edgeSupport: number;
  contrast: number;
  rectangularity: number;
  source?: string;
  fallbackReason?:
    | "invalid-image"
    | "uniform-image"
    | "no-candidate"
    | "low-confidence";
}
```

Confidence is a heuristic evidence score, not a probability that text is readable or that the crop is correct. Hosts should keep source corners inspectable and permit manual correction.

The default gates can be tuned deliberately:

```ts
const session = createScanSession({
  detectorOptions: {
    minConfidence: 0.55, // supported range: 0.15–0.95
    maxComponents: 8,    // supported range: 1–16
    maxCandidates: 24,   // supported range: 1–64
  },
});
```

Lowering confidence may reduce manual corrections while increasing false crops. Candidate limits trade processing time and memory for search breadth. Invalid values fail at session creation rather than silently changing behavior.

Use `detector: "none"` for manual-only operation. A same-origin `detectorModule` can replace the default engine while preserving the workflow contract.

## Verification and limitations

The deterministic unit corpus covers bright and dark documents, rotation, perspective, low contrast, noise, shadows, outside clutter, narrow receipts, uniform images, invalid inputs and a no-document false-positive case. Browser automation runs a generated perspective capture through the real decoder, worker, detector and session API in Chromium, Firefox and WebKit. The size audit counts the detector entry and its copy inside the worker.

Synthetic fixtures establish repeatability, not production accuracy. Before public beta, add a licensed and consented real-photo corpus with ground-truth corners covering glare, folds, curves, clipped pages, hands, patterned surfaces, multiple documents, receipts, identity cards, screen captures and diverse lighting. Publish success rate, false-positive rate, mean corner error, intersection-over-union, manual-fallback rate, latency and memory on the same fixtures used for competitor comparisons.

Automatic cropping must remain advisory. A weak or ambiguous image should fall back to manual editing instead of returning confident but unsupported corners.
