# Changelog

Notable changes to ScanFit will be recorded here. The project follows [Semantic Versioning](https://semver.org/).

## Unreleased

## 0.1.0-alpha.2 - 2026-09-01

### Fixed

- Explicitly include the package README in the published npm tarball so npm can render installation, computer-vision, size-contract and alpha-testing documentation.

## 0.1.0-alpha.1 - 2026-09-01

### Added

- Package-level npm README with installation, integration examples, constraints and documentation links.

## 0.1.0-alpha.0 - 2026-09-01

### Added

- Framework-independent scan sessions and React scanner interfaces.
- Camera and JPEG/PNG/WebP import workflow with correction, filters and page editing.
- Exact-byte PDF export contract, page diagnostics and final-pixel inspection.
- Worker processing, browser codec fallback, cancellation and lifecycle cleanup.
- Vite and Webpack consumer verification, three-browser Playwright CI, qpdf validation and runtime-size budgets.
- Hosted interactive demo and initial project documentation.
- Runnable Vite React, Next.js, vanilla TypeScript, Vue and Svelte consumers.
- Contribution, conduct, support, security and dependency-maintenance policies.
- Independent typed-array document detector with region and Hough-line candidates, evidence diagnostics, configurable confidence gates and manual fallback; Scanic is no longer a dependency.
- First public npm alpha as `@scanfit/browser`, published under the `next` distribution tag.

### Security

- Fresh JPEG encoding and removal of EXIF/XMP APP1 metadata before PDF embedding.
- Input, page, pixel and session limits before image processing.

This is an alpha release. The API may change before the public beta.
