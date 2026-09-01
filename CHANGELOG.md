# Changelog

Notable changes to ScanFit will be recorded here. The project follows [Semantic Versioning](https://semver.org/) once packages begin publishing.

## Unreleased

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

### Security

- Fresh JPEG encoding and removal of EXIF/XMP APP1 metadata before PDF embedding.
- Input, page, pixel and session limits before image processing.

No npm package or stable API has been released yet.
