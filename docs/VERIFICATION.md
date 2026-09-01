# Verification record

Measured locally on 31 August 2026. This records evidence for the alpha implementation, not a public-beta certification.

## Environment

- Apple M4, arm64; macOS 26.5.1 (25F80), Darwin 25.5.0.
- Installed Chrome 151.0.7922.175, headless automation; Node 22.23.2.
- No physical Android or iPhone device was available. Firefox/WebKit browser installation failed because the host ran out of disk space; no unrelated user files were deleted. Checks continued with installed Chrome.

## Automated checks

- TypeScript checking, ESM library build and declaration generation: passed.
- 45 unit tests: passed. Covers image headers/metadata, quad geometry, alpha compositing, rotation, exact byte boundaries, final PDF overhead, impossible budgets, non-monotonic encoders, cancellation, session disposal and worker failure/retry.
- 8 Chrome browser scenarios: passed. Covers capture/import through explicit confirmation/download; actual worker operation; PDF.js decoding/rendering; all eight JPEG EXIF orientations; white alpha compositing; cannot-fit diagnostics; atomic replacement; cancellation/retry; keyboard/tap crop controls; RTL mobile viewport; dialog focus; denied/simulated camera permission; track cleanup; forced native-canvas bridge fallback; a native-resolution crop from a 25-megapixel source; and queued-job disposal without worker resurrection.
- Actual distributed entry points in production Vite and Webpack consumers: passed. Each imported a photo, exported a PDF below 100,000 bytes, opened the lazy dialog and loaded styles, with no failed asset requests or page exceptions. Node import checks passed without creating DOM/camera/worker resources.
- Chrome privacy assertions found no external/document upload requests, no local/session storage entries, and no copied source EXIF or filenames in the test output. This is a scoped automated check, not a security audit of arbitrary host applications or plugins.
- `npm audit --audit-level=moderate`: zero reported vulnerabilities in the installed dependency graph. The test-only PDF.js renderer was updated to 6.2.108 before testing.
- A CI workflow is included for three browser engines plus `qpdf --check`. It has not been run remotely. qpdf, native Preview/Acrobat and real screen-reader checks remain unverified here.

## Runtime size

Measured by `npm run size`. Values are sums of individually compressed emitted assets at gzip level 9 / Brotli quality 11. 1 KiB = 1024 bytes.

| Distribution scope | Raw bytes | Gzip bytes (KiB) | Brotli bytes (KiB) | Gzip target |
| --- | ---: | ---: | ---: | ---: |
| Trigger plus eagerly imported CSS | 11,250 | 3,465 (3.38) | 3,010 (2.94) | ≤5 KiB |
| Core + React workflow + CSS/shared chunks | 62,378 | 17,408 (17.00) | 15,273 (14.92) | ≤35 KiB |
| Every distributed runtime asset | 304,533 | 109,430 (106.87) | 94,959 (92.73) | ≤120 KiB |

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

`work/workflow.png` shows final JPEG inspection and confirmed download. `work/mobile-rtl.png` shows the responsive RTL editor. `work/browser-export.pdf` is a generated synthetic document that can be opened in additional readers. PDF.js rendered test pages with nonempty content; that does not certify readability of faint handwriting, tiny type, signatures or complex documents.

The React review led to explicit resource cleanup, stable session options, stale-job protection, immediate crop commits, focus handling and non-drag controls. The documentation is organized around the supplied implementation plan and observed test results; release targets are kept separate from measurements.

Use [the release checklist](RELEASE_CHECKLIST.md) before publishing. No competitor benchmark, accessibility certification, production security guarantee or virality claim has been established.
