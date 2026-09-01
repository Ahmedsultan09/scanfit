# Release checklist

The code implements the planned beta workflow. Do not interpret local automated checks as completion of the 6–8 week validation and pilot program.

## Implemented

- [x] Framework-independent sessions plus React scanner, lazy trigger and hook.
- [x] Camera/manual shutter; still JPEG, PNG and WebP import; source limits and EXIF parsing.
- [x] Independent classical detector with evidence diagnostics and honest fallback; manual corners, magnifier, keyboard/tap controls, perspective correction, rotation, filters, reorder, removal and atomic replacement.
- [x] Non-destructive editing, bounded export search, exact final-PDF byte check, page reports and exported-pixel inspection before confirmation.
- [x] Cancellation, stale-job rejection, worker/canvas fallback, source/URL/bitmap cleanup and camera track shutdown.
- [x] ESM/types, SSR-safe import checks, production Vite/Webpack consumer checks, synthetic fixtures and local documentation.
- [x] Runtime-size budget check and desktop performance smoke measurements.
- [x] CI workflow passed remotely for Chromium, Firefox, WebKit and qpdf on independent-detector commit `c6fb3ef`.
- [x] Runnable Vite React, Next.js App Router, vanilla TypeScript, Vue and Svelte examples with automated production builds.

## Before calling this a public beta

- [ ] Run the worker, camera, codec-fallback and export feasibility gate on a physical Pixel 4a-class device and iPhone SE (2nd generation). Record exact OS/browser versions, cold/warm timing distributions and thermal conditions.
- [x] Run the full Playwright workflow in Chromium, Firefox and WebKit locally and in GitHub Actions.
- [x] Validate the generated CI PDF with `qpdf --check` and render it with PDF.js automation.
- [ ] Open representative generated PDFs manually in Chrome, Firefox, Safari/Preview and Acrobat. Automated structure and rendering checks do not cover every reader.
- [ ] Expand the licensed detector/export corpus beyond synthetic examples: small/faint text, handwriting, colored stamps, signatures, Arabic/Latin documents, shadows, creases, glare, clipped borders, curved pages, hands, patterned surfaces, multiple documents, extreme perspective and corrupted/hostile files. Record ground-truth corners, false positives, fallback rates and tolerances; review exported pixels against the source.
- [ ] Exercise PNG/WebP EXIF and JPEG orientation on physical Safari, not only Playwright WebKit. Verify embedded color profiles and device camera formats.
- [ ] Audit browser-native image/canvas/WASM memory separately from JavaScript heap and tracked buffers. Run repeated 1-, 5-, 20-page sessions on both phones; record resource-retention observations after disposal.
- [ ] Validate main-thread task durations, worst-case 12-encode searches, cancellation responsiveness, offline behavior and strict CSP deployment on those devices.
- [ ] Manual screen-reader, keyboard-only, tap-only, 200%/400% zoom and RTL trials; inspect contrast and focus when pages are removed or the workflow changes views.
- [ ] Dependency/security review, malformed-file fuzzing, unsupported-format recovery and host integration documentation review.
- [ ] Three developer integrations and ten user trials; triage and resolve release-blocking findings.
- [ ] Check and approve the final package name, remove the private publishing safeguard only with approval, and decide the release/version process.

## Deferred enhancements, in order

1. Front-and-back layout on one PDF page.
2. Separately imported, opt-in recovery storage with expiry and deletion.
3. Irreversible exported-pixel redaction with tests proving originals are absent.
4. Throttled live guidance and automatic capture, gated by device benchmarks.
5. Separate HEIC, PDF import, ML, OCR and searchable-PDF extensions with disclosed sizes.

Never defer final byte-limit checks, preservation of accepted pages, or cleanup to ship an enhancement sooner. Publish competitor comparisons only after benchmarking identical inputs/settings; no superiority or virality claim has been established.
