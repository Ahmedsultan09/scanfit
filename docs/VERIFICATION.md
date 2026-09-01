# Verification record

Updated 1 September 2026. This records reproducible evidence for the hosted alpha implementation, not a public-beta certification.

## Environment

- Apple M4, arm64; macOS 26.5.1 (25F80), Darwin 25.5.0.
- Installed Chrome 151.0.7922.175 plus Playwright Firefox 153 and WebKit 26.5 browser runtimes; Node 22.23.2.
- GitHub Actions uses Ubuntu, Node 22, Playwright Chromium/Firefox/WebKit and qpdf. The successful run for commit `9afcbbe` is [available on GitHub](https://github.com/Ahmedsultan09/scanfit/actions/runs/33490572249).
- No physical Android or iPhone device was available. Desktop browser engines and mobile viewports do not replace device camera, thermal, memory or native-codec testing.

## Automated checks

- TypeScript checking, ESM library build and declaration generation: passed.
- 47 unit tests: passed locally and in CI. Coverage includes image headers/metadata, removal of browser-added JPEG APP1 metadata, duplicate EXIF handling, quad geometry, alpha compositing, rotation, exact byte boundaries, final PDF overhead, impossible budgets, non-monotonic encoders, cancellation, session disposal and worker failure/retry.
- 24 browser scenarios passed locally and in CI: the same eight workflows in Chromium, Firefox and WebKit. They cover capture/import through explicit confirmation/download; actual worker operation; PDF.js decoding/rendering; all eight JPEG EXIF orientations; white alpha compositing; cannot-fit diagnostics; atomic replacement; cancellation/retry; keyboard/tap crop controls; RTL mobile viewport; dialog focus; denied/simulated camera permission; track cleanup; forced native-canvas bridge fallback; a native-resolution crop from a 25-megapixel source; and queued-job disposal without worker resurrection.
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
| Core + React workflow + CSS/shared chunks | 63,107 | 17,637 (17.22) | 15,462 (15.10) | ≤35 KiB |
| Every distributed runtime asset | 306,001 | 109,858 (107.28) | 95,290 (93.06) | ≤120 KiB |

The trigger JavaScript alone is 730 gzip bytes. The full conservative count includes JS, CSS, the processing worker and its embedded WASM, lazy entry points, **and** standalone detector/PDF adapters that duplicate some worker code. It excludes only host React, browser-native facilities, declarations and non-runtime documentation. There are no separately downloaded model or WASM assets. A consumer may load less; this record does not claim every host will reproduce identical wire sizes.

Source: `work/size-report.json`. The playground’s larger application bundle includes React and demo code; it is not the library runtime-size measurement. Public consumer fixtures verify packaging, while the conservative distribution audit checks the size ceiling.

## Desktop processing smoke benchmark

Built package served over local Vite, with no HTTP transfer compression. Fixtures are 1400×1800 synthetic PNG documents; they include Arabic/Latin text and a colored sample stamp. Input generation is outside the measured processing interval. The import measurement ends at the core’s editable-preview result, not React’s painted frame or the physical camera shutter.

| Metric | Observed |
| --- | ---: |
| Cold core module load, local HTTP | 24.2 ms |
| First worker import/detect/preview | 106.0 ms |
| Warm import/detect/preview, 30 runs | median 67.3 ms; empirical p95 73.5 ms |
| Warm five-page export, 10 runs, 2,000,000-byte limit | median 502.5 ms; empirical p95 575.4 ms |
| One-page session | import 99.5 ms; export 110.7 ms; 105,441-byte PDF |
| Five-page session | import 389.9 ms; export 538.9 ms; 529,823-byte PDF |
| Twenty-page session | import 1,397.3 ms; export 2,866.0 ms; 1,981,552-byte PDF |

No main-thread tasks over 50 ms were observed by Chrome’s Long Tasks observer during that synthetic run. This does not establish the target for all documents or devices. The reported final JavaScript heap sample was 18,755,529 bytes; **browser-native canvas, image-decoder and WASM memory are not included or measured as total memory**. Native allocation peaks and retention need dedicated device profiling.

Source: `work/benchmark-report.json`, including raw timing samples and methodology. The five-page case usually fits at the initial candidate, so its timing does not represent a worst-case 12-attempt-per-page export. Cold Internet download performance has not been measured. Do not advertise these desktop values as mobile performance or camera latency.

## Visual evidence and limitations

Local runs can generate `work/workflow.png`, `work/mobile-rtl.png` and `work/browser-export.pdf`. The CI run retains its `work/` and `test-results/` directories as a verification artifact. PDF.js rendered test pages with nonempty content, and qpdf accepted the generated structure; neither check certifies readability of faint handwriting, tiny type, signatures or complex documents.

The React review led to explicit resource cleanup, stable session options, stale-job protection, immediate crop commits, focus handling and non-drag controls. The documentation is organized around the supplied implementation plan and observed test results; release targets are kept separate from measurements.

Use [the release checklist](RELEASE_CHECKLIST.md) before publishing. No competitor benchmark, accessibility certification, production security guarantee or virality claim has been established.
