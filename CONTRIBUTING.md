# Contributing to ScanFit

ScanFit welcomes focused bug reports, document fixtures, integration examples and code changes. The project is still an unpublished alpha, so public APIs may change before the first beta.

## Before opening an issue

- Search existing issues and discussions.
- Use a synthetic, licensed or fully redacted document. Never attach identity documents, applications, signatures or other personal paperwork.
- For a security or privacy vulnerability, follow [SECURITY.md](SECURITY.md) instead of opening a public issue.
- Include the browser, operating system, input format, page count and configured byte limit when they affect the result.

Use GitHub Discussions for integration questions. Use the issue forms for reproducible bugs and scoped feature requests.

## Local setup

ScanFit requires Node.js 22 for its development environment.

```sh
git clone https://github.com/Ahmedsultan09/scanfit.git
cd scanfit
npm ci
npm run verify
npm run test:e2e
```

Install all Playwright engines before running the complete browser matrix:

```sh
npx playwright install chromium firefox webkit
SCANFIT_ALL_BROWSERS=1 npm run test:e2e
```

Run `npm run build` before using a local package from `packages/scanfit` in another project.

## Pull requests

1. Keep a change limited to one problem or feature.
2. Add or update tests for observable behavior.
3. Preserve the exact-byte contract, accepted pages and cleanup behavior.
4. Record any change to runtime bytes with `npm run size`.
5. Update the README, verification record or changelog when the public behavior changes.
6. Confirm that files and fixtures contain no private or unlicensed document content.

The CI workflow runs type checking, unit tests, production builds, size budgets, Vite/Webpack consumer checks, Chromium/Firefox/WebKit workflows and qpdf validation.

## Design constraints

- Document processing remains local by default; do not add document uploads or runtime CDNs.
- Heavy capabilities belong in opt-in modules with disclosed download sizes.
- Do not silently omit pages, change color mode or cross configured quality floors to meet a byte limit.
- Browser operations must remain lazy and safe during server rendering.
- Editing must retain keyboard and tap alternatives to dragging.

Contributions are licensed under the repository's [MIT License](LICENSE).
