# ScanFit — lightweight scan-to-PDF

An MIT-licensed TypeScript library for **capture/import → correct pages → fit an upload limit → inspect → return a PDF File**. React components are optional; document processing happens locally in a worker.

**Status: hosted alpha implementation, not a release-certified beta.** The demo is deployed and the cross-browser CI suite is green, but the package has not been published. `@scanfit/browser` remains a private working name pending approval and namespace ownership. Physical-device testing, broader document fixtures, and user pilots remain release gates.

**Live demo:** [scanfit-two.vercel.app](https://scanfit-two.vercel.app)

## Run it locally

Use Node 22. From this directory:

```sh
npm ci
npm run dev
```

Open `http://127.0.0.1:5173`. Try the synthetic sample documents or choose your own JPEG, PNG, or WebP photos. Samples are generated in your browser; there is no sample-image service.

```sh
npm run verify         # types, unit tests, build, sizes, Vite/Webpack consumers
npm run test:e2e       # browser workflow, pixels, PDF rendering, lifecycle
npm run benchmark     # requires the dev server; desktop smoke measurements
```

Browser checks use the installed Chrome on macOS when available. Otherwise install Playwright Chromium with `npx playwright install chromium`, or set `SCANFIT_CHROME` to an executable. Set `SCANFIT_ALL_BROWSERS=1` to include Firefox and WebKit after installing their Playwright browsers. GitHub Actions runs all three engines and validates the generated PDF with qpdf. Emulation is not a substitute for physical phones.

## React integration

Build first with `npm run build`. The workspace links `@scanfit/browser` locally. Other projects can install the local `packages/scanfit` directory; do not run an npm registry install for this unapproved name.

```tsx
import { DocumentScanner } from "@scanfit/browser/react";
import "@scanfit/browser/styles.css";

export function ApplicationDocuments() {
  return (
    <DocumentScanner
      maxBytes={2_000_000}
      qualityLimits={{ minQuality: 0.65, minLongEdge: 1600 }}
      onComplete={({ file, report }) => {
        // Runs only after the user inspects the export and selects “Use this PDF”.
        // Store `file` in your form state; your application owns submission.
        console.log(file.size, report.pages.length);
      }}
    />
  );
}
```

For a small initial JavaScript download:

```tsx
import { ScannerTrigger } from "@scanfit/browser/trigger";
import "@scanfit/browser/styles.css";

<ScannerTrigger
  maxBytes={2_000_000}
  onComplete={({ file }) => attachToForm(file)}
>
  Scan documents
</ScannerTrigger>;
```

The trigger imports the scanner when opened. CSS is an explicit import; its bytes are included in the initial trigger budget. React is a peer dependency and is not bundled. Imports do not open cameras or create workers during server rendering. Mount interactive components within your framework’s client boundary.

`DocumentScanner` also accepts `onClose`, `onError`, `session`, `options`, `messages`, `dir`, `className`, `renderHeader`, and `renderPageSummary`. `ScannerTrigger` adds `children` and `loadingLabel`. Use `useScanSession(options)` for headless React integration. Changing session option values creates a fresh owned session; changing object identity alone does not.

## Framework-independent core

```ts
import { createScanSession, ScanError } from "@scanfit/browser/core";

const session = createScanSession();
const unsubscribe = session.subscribe(() => renderState(session.getSnapshot()));

try {
  const pages = await session.addFiles(fileInput.files ?? []);
  session.updatePage(pages[0].id, { rotation: 90, filter: "natural" });

  const controller = new AbortController();
  const result = await session.exportPdf({
    maxBytes: 2_000_000, // Required integer bytes, not “2 MB”.
    pageSize: "a4", // 'a4' | 'letter' | 'image'
    minQuality: 0.65,
    minLongEdge: 1600,
    signal: controller.signal,
  });

  if (result.status === "ready") {
    // Present result.report.pages[*].preview to the user before using result.file.
    // These JPEG blobs contain the exact pixels embedded in the PDF.
    inspectBeforeSubmitting(result.file, result.report);
  } else if (result.status === "cannot-fit") {
    explainLimits(result.candidateBytes, result.report);
  } // cancelled: no completed result; accepted pages remain in the session.
} catch (error) {
  if (error instanceof ScanError)
    showActionableError(error.code, error.message);
  else throw error;
} finally {
  unsubscribe();
  session.dispose(); // Do this when the workflow ends, not before asynchronous inspection.
}
```

The example’s application functions are placeholders. A headless consumer owns final confirmation and must retain its session until editing is finished. `File` and preview `Blob` objects already returned remain valid after session disposal if the host retains them.

## Framework examples

Runnable consumers live in [`examples/`](examples/README.md):

- Vite + React uses the lazy `ScannerTrigger` and complete scanner dialog.
- Next.js App Router places the scanner behind an explicit client boundary.
- Vanilla TypeScript, Vue and Svelte demonstrate the framework-independent session core.

`npm run test:examples` builds all five against the local package. These examples use the workspace version during development; after publishing, an external application will install the registry version instead.

### Session operations

| Method                                         | Behavior                                                                                                       |
| ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `getSnapshot()` / `subscribe(listener)`        | Stable snapshot until a change; includes pages, status, progress, result and typed error.                      |
| `addFiles(blobs, { signal? })`                 | Header validation and serial detection; returns accepted pages. Cancellation preserves already accepted pages. |
| `addFiles([blob], { replacePageId, signal? })` | Atomic replacement: keep the old page until the new one succeeds.                                              |
| `updatePage(id, edits)`                        | Set corners, quarter-turn rotation, or appearance. Invalidates a prepared export.                              |
| `movePage(id, index)` / `removePage(id)`       | Zero-based reorder or explicit removal. Invalidates prepared output.                                           |
| `renderPage(id, signal?)`                      | Fresh corrected preview from the source and edits; not the final compressed export preview.                    |
| `exportPdf(options)`                           | Returns `ready`, `cannot-fit`, or `cancelled`. Unexpected failures throw `ScanError`.                          |
| `cancel()`                                     | Stop work and clear prepared output, retaining accepted pages.                                                 |
| `dispose()`                                    | Stop work, terminate the worker, release session references; safe to repeat.                                   |

Corners are clockwise **top-left, top-right, bottom-right, bottom-left**, normalized to `[0, 1]` in the EXIF-oriented original image, before the requested quarter-turn rotation. Updates are non-destructive. Page previews and thumbnails are JPEG blobs; object URLs created by host code must be revoked by that code.

## Size contract and quality

The final PDF, including structural overhead, is measured. A `ready` result never exceeds `maxBytes`. The main thread independently checks the worker’s result before constructing the `File`.

- Start at JPEG quality `0.9`; allocate page budgets in proportion to initial encoded sizes and carry unused capacity forward.
- Search at most 12 quality/resolution candidates per page, retaining measured candidates rather than assuming encoder sizes are monotonic.
- Default floors: quality `0.65`, long edge `1600` pixels or the crop’s smaller native size. Maximum processing dimensions: 2400-pixel long edge and four megapixels. No intentional upscaling.
- `minQuality` accepts `0.1–0.9`; `minLongEdge` accepts integer `128–2400`. Lower floors require an explicit host configuration, never an automatic decision.
- `cannot-fit` means this bounded search did not fit within the configured limits, not a proof that no possible encoding could fit. It includes the smallest retained candidates and diagnostics for inspection.
- Never silently omit pages, switch to grayscale, or cross the configured floors. Floors do not guarantee readable text.

Reports contain exact PDF bytes, the requested limit, page-size choice, configured floors, and each page’s JPEG bytes, dimensions, quality, attempt count, warnings, and final JPEG preview. Image contributions exclude PDF structure. The review screen shows exact integer byte counts and zoomable exported pixels.

A4 and Letter use aspect-preserving containment with white margins. Image-proportional pages use the exported image dimensions at 0.75 PDF points per pixel. Source transparency is composited onto white. Color is preserved by default; grayscale and contrast require an explicit selection.

## Modules and processing

```text
@scanfit/browser/trigger    small React dialog launcher
@scanfit/browser/react      ready-made UI, useScanSession, message dictionary
@scanfit/browser/core       sessions, validation, worker coordination, types
@scanfit/browser/detector   replaceable Scanic classical detector adapter
@scanfit/browser/pdf        bounded planner and tinypdf JPEG writer
@scanfit/browser/styles.css optional UI stylesheet (required for the ready-made design)
```

These are independent ESM entry points in one package, not four independently published packages. TypeScript declarations are emitted for each entry. No PDF viewer, OCR engine, HTML renderer, ML runtime, or font engine is included in the runtime.

One worker handles a serial queue per active session. Detection runs at an 800-pixel long edge. Perspective correction and filters are worker pixel code. Export first decodes the source crop’s bounding region, then applies perspective correction, so a small crop inside a large photo is not prematurely downsampled. Only the active page’s decoded working set is retained; compressed sources, thumbnails and export candidate JPEGs remain until no longer needed.

Worker-native decoding/encoding uses `createImageBitmap` and `OffscreenCanvas`. Feature failures fall back to a main-thread native canvas codec bridge with transferred pixel buffers. Pixel transformations remain in the worker. Classical detection currently requires worker canvas support; without it, the UI explains that corners need manual adjustment. A JavaScript detection fallback can be used when Scanic’s WASM is unavailable. All fallback paths still need real Safari/device validation.

The Scanic `1.6.0` build-time adapter disables its optional ML loader. The transform fails if the pinned loader shape changes. `tinypdf` is pinned to `0.4.1`. Both MIT notices are distributed with the package.

### Replace the detector

Serve a same-origin ES module exporting `createDetector(): DocumentDetector`, then pass `detectorModule: '/assets/my-detector.js'` to `createScanSession`. Its `detect(ImageData)` method returns `{ corners: Quad | null, confidence?: number }`. The input is the oriented detection-size image; return normalized coordinates. Use `detector: 'none'` for manual cropping only. Custom modules own their own dependency sizes, privacy behavior, and licensing.

The default Scanic adapter declines weak outlines below a `0.4` confidence heuristic. Detection can still be wrong: source corners and final pixels must remain inspectable.

## Privacy, safety and host responsibilities

- No backend, account, upload request, telemetry, document persistence, CDN dependency, or watermark.
- Sources live in memory. Browser refresh or closure loses unfinished work. Disposal releases references; it does **not** certify secure memory erasure.
- Images are freshly encoded without copying source EXIF/XMP or filenames into the PDF. Do not attach source metadata through a custom adapter.
- Defaults: 20 pages, 25 MiB per source, 25 megapixels per image, 100 MiB total sources. Override through `options.limits` deliberately. Headers are inspected before decoding, but these checks are not a comprehensive hostile-file security audit.
- Still JPEG, PNG and WebP only. Animated PNG/WebP are rejected. No HEIC, existing PDF import, OCR, searchable text, tagged/accessibility PDF, digital signature, or redaction feature.
- Camera use requires HTTPS or localhost and permission. Embedded applications may need camera permission delegated by their host. Tracks stop on camera close, unmount, capture, or a hidden tab.
- Serve JS, worker assets and CSS from your application. A custom `workerUrl` must be same-origin and implement the library worker protocol; it is an advanced integration, not an arbitrary Worker object.
- Worker policy needs same-origin module workers (`worker-src 'self'`). Scanic’s embedded WASM can require `script-src 'wasm-unsafe-eval'`; restrictive policies may select its JavaScript fallback. Preview images need `img-src blob:`. UI geometry uses inline styles; account for that in `style-src-attr`. This is a requirements list, not a drop-in CSP for every host.
- Keep the host page and third-party scripts trustworthy: they share the page environment and may observe files the user selects. The library cannot enforce a privacy promise on behalf of the host.

## Accessibility and customization

Crop by dragging, keyboard arrows (Shift for larger steps), or corner selection plus tap-operated nudge buttons. Changes apply immediately. Reordering has buttons. The dialog uses native modal focus behavior and restores focus to its trigger. Busy work and errors are announced; final review receives focus. Closing a populated scanner asks before discarding.

Provide `messages` to replace user-facing UI labels and explanations, and `loadingLabel` for the lazy trigger. Core errors have stable `ScanError.code` values; localize error presentation through the host if needed. Set `dir="rtl"`, override `--sf-*` variables through a scoped CSS rule, or build a custom interface with the headless hook/core. The current keyboard tests are not a WCAG certification or a substitute for screen-reader trials.

## Evidence and next steps

See [verification notes](docs/VERIFICATION.md) for measured sizes, the desktop benchmark, checked behavior and pending release gates. [The release checklist](docs/RELEASE_CHECKLIST.md) maps the remaining work to the implementation plan. The hosted CI run and local commands regenerate evidence; raw local artifacts live in the ignored `work/` directory.

MIT licensed. Package publishing and the final name require separate approval.

## Community and maintenance

- Read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a pull request or sharing a fixture.
- Ask usage questions in [GitHub Discussions](https://github.com/Ahmedsultan09/scanfit/discussions).
- Use the structured issue forms for bugs and feature requests.
- Report vulnerabilities privately according to [SECURITY.md](SECURITY.md).
- Follow unreleased changes in [CHANGELOG.md](CHANGELOG.md).

Public reports must use synthetic, licensed or fully redacted documents. ScanFit is currently maintained as an unpaid alpha without guaranteed support times.
