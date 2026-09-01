# Verification record

Updated 1 September 2026. This records reproducible evidence for the hosted alpha implementation, not a public-beta certification.

## Environment

- Apple M4, arm64; macOS 26.5.1 (25F80), Darwin 25.5.0.
- Installed Chrome 152.0.7977.65 plus Playwright Firefox 153 and WebKit 26.5 browser runtimes; Node 22.23.2.
- GitHub Actions uses Ubuntu, Node 22, Playwright Chromium/Firefox/WebKit and qpdf. The independent-detector run for commit `c6fb3ef` is [available on GitHub](https://github.com/Ahmedsultan09/scanfit/actions/runs/33505512884).
- No physical Android or iPhone device was available. Desktop browser engines and mobile viewports do not replace device camera, thermal, memory or native-codec testing.

## Automated checks

- TypeScript checking, ESM library build and declaration generation: passed.
- 56 unit tests passed locally and in CI. Detector ground truth covers bright and dark pages, rotation, perspective, low contrast, noise, shadows, outside clutter, narrow receipts, uniform and invalid inputs, non-finite standalone tuning, and an unstructured no-document false-positive case. It checks normalized mean corner error and rasterized quadrilateral intersection-over-union. The remaining coverage includes image headers/metadata, browser-added JPEG APP1 removal, duplicate EXIF handling, quad geometry, alpha compositing, rotation, exact byte boundaries, final PDF overhead, impossible budgets, non-monotonic encoders, cancellation, session disposal and worker failure/retry.
- 27 browser scenarios passed locally and in CI: the same nine workflows in Chromium, Firefox and WebKit. They cover capture/import through explicit confirmation/download; the independent detector and evidence report in the real worker; PDF.js decoding/rendering; all eight JPEG EXIF orientations; white alpha compositing; cannot-fit diagnostics; atomic replacement; cancellation/retry; keyboard/tap crop controls; RTL mobile viewport; dialog focus; denied/simulated camera permission; track cleanup; detection through the forced native-canvas bridge; a native-resolution crop from a 25-megapixel source; and queued-job disposal without worker resurrection.
- `npm run test:independence` passed: Scanic is absent from the package manifest, reproducible lockfile and emitted JavaScript/WASM runtime. The detector uses no model, network request or WASM asset.
- Actual distributed entry points in production Vite and Webpack consumers: passed. Each imported a photo, exported a PDF below 100,000 bytes, opened the lazy dialog and loaded styles, with no failed asset requests or page exceptions. Node import checks passed without creating DOM/camera/worker resources.
- Runnable Vite React, Next.js App Router, vanilla TypeScript, Vue and Svelte examples build against the local package. Each emitted the processing worker; Next kept its route statically prerendered while dynamically loading the client scanner.
- Cross-browser privacy assertions found no external document requests, no local/session storage entries, and no copied source EXIF or filenames in test output. WebKit-specific coverage verifies that APP1 metadata added by its native JPEG encoder is removed before PDF embedding. This remains a scoped automated check, not a security audit of arbitrary host applications or plugins.
- `npm audit --audit-level=moderate`: zero reported vulnerabilities in the installed dependency graph. The test-only PDF.js renderer was updated to 6.2.108 before testing.
- GitHub Actions passed the complete build, package-size, consumer, three-browser and `qpdf --check` workflow. Native Preview/Acrobat and real screen-reader checks remain unverified.
- The production deployment at [scanfit-two.vercel.app](https://scanfit-two.vercel.app) returned its expected security headers and completed the three-page sample workflow through final PDF confirmation without browser errors.

## Runtime size

Measured by `npm run size`. Values are sums of individually compressed emitted assets at gzip level 9 / Brotli quality 11. 1 KiB = 1024 bytes.

| Distribution scope | Raw bytes | Gzip bytes (KiB) | Brotli bytes (KiB) | Gzip target |
| --- | ---: | ---: | ---: | ---: |
| Trigger plus eagerly imported CSS | 11,250 | 3,465 (3.38) | 3,010 (2.94) | ≤5 KiB |
| Core + React workflow + CSS/shared chunks | 63,917 | 17,847 (17.43) | 15,642 (15.28) | ≤35 KiB |
| Every distributed runtime asset | 137,768 | 43,241 (42.23) | 37,953 (37.06) | ≤120 KiB |

The trigger JavaScript alone is 730 gzip bytes. The full conservative count includes JS, CSS, the processing worker, lazy entry points, **and** standalone detector/PDF entries that duplicate some worker code. It excludes only host React, browser-native facilities, declarations and non-runtime documentation. There are no separately downloaded model or WASM assets. The independent detector entry is 5,541 gzip bytes. A consumer may load less; this record does not claim every host will reproduce identical wire sizes.

Source: `work/size-report.json`. The playground’s larger application bundle includes React and demo code; it is not the library runtime-size measurement. Public consumer fixtures verify packaging, while the conservative distribution audit checks the size ceiling.

## Desktop processing smoke benchmark

Built package served over local Vite, with no HTTP transfer compression. Fixtures are 1400×1800 synthetic PNG documents; they include Arabic/Latin text and a colored sample stamp. Input generation is outside the measured processing interval. The import measurement ends at the core’s editable-preview result, not React’s painted frame or the physical camera shutter.

| Metric | Observed |
| --- | ---: |
| Cold core module load, local HTTP | 17.3 ms |
| First worker import/detect/preview | 142.1 ms |
| Warm detector only, 30 runs | median 41.7 ms; empirical p95 70.6 ms |
| Warm import/detect/preview, 30 runs | median 71.1 ms; empirical p95 100.4 ms |
| Warm five-page export, 10 runs, 2,000,000-byte limit | median 502.0 ms; empirical p95 565.1 ms |
| One-page session | import 124.7 ms; export 110.8 ms; 111,535-byte PDF |
| Five-page session | import 506.5 ms; export 553.4 ms; 561,042-byte PDF |
| Twenty-page session | import 1,580.7 ms; export 3,290.8 ms; 1,976,201-byte PDF |

No main-thread tasks over 50 ms were observed by Chrome’s Long Tasks observer during that synthetic run. This does not establish the target for all documents or devices. The reported final JavaScript heap sample was 17,590,775 bytes; **browser-native canvas and image-decoder memory are not included or measured as total memory**. Native allocation peaks and retention need dedicated device profiling.

Source: `work/benchmark-report.json`, including raw timing samples and methodology. The five-page case usually fits at the initial candidate, so its timing does not represent a worst-case 12-attempt-per-page export. Cold Internet download performance has not been measured. Do not advertise these desktop values as mobile performance or camera latency.

## Visual evidence and limitations

Local runs can generate `work/workflow.png`, `work/mobile-rtl.png` and `work/browser-export.pdf`. The CI run retains its `work/` and `test-results/` directories as a verification artifact. PDF.js rendered test pages with nonempty content, and qpdf accepted the generated structure; neither check certifies readability of faint handwriting, tiny type, signatures or complex documents.

The detector implementation adds explicit evidence and fallback reasons without treating synthetic accuracy as field validation. The React review led to explicit resource cleanup, stable session options, stale-job protection, immediate crop commits, focus handling and non-drag controls. The documentation is organized around the supplied implementation plan and observed test results; release targets are kept separate from measurements.

Use [the release checklist](RELEASE_CHECKLIST.md) before publishing. No competitor benchmark, accessibility certification, production security guarantee or virality claim has been established.
