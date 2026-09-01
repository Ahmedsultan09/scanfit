# @scanfit/browser

Build an in-browser document workflow that turns camera captures or image files into an inspected PDF under an exact upload limit.

**Capture or import → detect and correct → reorder → fit the byte limit → inspect → receive a PDF `File`.**

- [Try the live demo](https://scanfit-two.vercel.app)
- [Read the complete documentation](https://github.com/Ahmedsultan09/scanfit#readme)
- [Report a problem or share feedback](https://github.com/Ahmedsultan09/scanfit/issues)

> ScanFit is a public alpha under active development. Test it with the real documents, browsers and physical devices your users have before adopting it in a production workflow.

## Why ScanFit?

A document-upload field often assumes the PDF already exists. When the source is still on paper, users may have to leave a form, open a separate scanner app, export a PDF, return to the form and discover that the file exceeds the portal's limit.

ScanFit lets the host application provide that workflow without sending the document to a ScanFit backend. The host receives the confirmed `File` and remains responsible for submission.

## Install

```sh
npm install @scanfit/browser@next
```

React is optional. Install React 18.2 or 19 only when using the ready-made React interface.

## React scanner

```tsx
import { DocumentScanner } from "@scanfit/browser/react";
import "@scanfit/browser/styles.css";

export function ApplicationDocuments() {
  return (
    <DocumentScanner
      maxBytes={2_000_000}
      onComplete={({ file, report }) => {
        // Runs after the user inspects and confirms the exported PDF.
        attachToForm(file, report);
      }}
    />
  );
}
```

Use `@scanfit/browser/trigger` for a small lazy-loaded dialog launcher or `useScanSession` for a headless React integration.

## Framework-independent TypeScript

```ts
import { createScanSession } from "@scanfit/browser/core";

const session = createScanSession();
await session.addFiles(selectedImages);

const result = await session.exportPdf({ maxBytes: 2_000_000 });

if (result.status === "ready") {
  receivePdf(result.file, result.report);
} else if (result.status === "cannot-fit") {
  showCompressionLimits(result.report);
}

session.dispose();
```

## Computer vision in the browser

The built-in classical detector runs locally in the processing worker. It uses luminance preprocessing, connected edges, region candidates and line geometry to estimate the document's four corners. Those corners drive perspective correction so an angled phone photo becomes a flat page.

Detection is deliberately treated as fallible:

- Low-confidence results fall back to manual cropping.
- Users can adjust all four corners with pointer, keyboard or tap-operated controls.
- Advisory warnings identify possibly blurry, dark or low-resolution pages.
- Detector diagnostics expose confidence, edge support, contrast, coverage and rectangularity.
- The detector is replaceable through the framework-independent `DocumentDetector` interface.

No ML model, document-related network request or public CDN is required by the default workflow.

## Exact finished-PDF size contract

`maxBytes` is a required positive integer. ScanFit measures the completed PDF, including structural overhead—not only the JPEG page images.

- A `ready` result never exceeds `maxBytes`.
- Reports include total bytes and each page's image bytes, dimensions, JPEG quality, attempt count, warnings and final compressed preview.
- The review screen displays the compressed pixels that will be embedded in the PDF.
- `cannot-fit` is returned when the bounded search cannot meet the limit without crossing the configured quality and resolution floors.
- ScanFit never silently removes pages, changes the color mode or crosses those floors.

Quality floors constrain automatic compression; they do not guarantee that text is readable. Users should inspect small text, signatures, stamps and faint marks before confirmation.

## Included workflow

- Manual camera capture and JPEG, PNG or WebP import.
- Automatic corner detection with manual correction.
- Perspective correction, rotation, retaking and removal.
- Drag-free page reordering.
- Natural color, grayscale and contrast filters.
- A4, US Letter and image-proportional PDF pages.
- Worker processing, cancellation, stale-job protection and cleanup.
- Message dictionaries, RTL layout support and CSS variables.
- React components plus a framework-independent TypeScript core.

## Package entry points

| Import | Purpose |
| --- | --- |
| `@scanfit/browser/react` | Ready-made scanner and `useScanSession` |
| `@scanfit/browser/trigger` | Small lazy-loaded scanner trigger |
| `@scanfit/browser/core` | Sessions, validation, worker coordination and types |
| `@scanfit/browser/detector` | Replaceable classical detector |
| `@scanfit/browser/pdf` | Bounded PDF size planner and writer |
| `@scanfit/browser/styles.css` | Optional ready-made interface styles |

## Current alpha limits

ScanFit currently creates image-only PDFs. It does not include HEIC conversion, existing-PDF import, OCR, searchable or tagged PDFs, redaction, automatic capture, document persistence, telemetry or uploads.

Camera behavior, browser codec fallbacks, accessibility and performance still require broader testing on physical mobile devices and real document collections. If you try ScanFit, please report difficult detection cases, unclear controls, output-quality problems, integration friction and missing workflows through [GitHub Issues](https://github.com/Ahmedsultan09/scanfit/issues).

## Documentation and examples

- [Complete usage and API guide](https://github.com/Ahmedsultan09/scanfit#readme)
- [Detector design](https://github.com/Ahmedsultan09/scanfit/blob/main/docs/DETECTOR.md)
- [Verification evidence](https://github.com/Ahmedsultan09/scanfit/blob/main/docs/VERIFICATION.md)
- [Release checklist](https://github.com/Ahmedsultan09/scanfit/blob/main/docs/RELEASE_CHECKLIST.md)
- [Next.js, React, Vue, Svelte and vanilla TypeScript examples](https://github.com/Ahmedsultan09/scanfit/tree/main/examples)
- [Security policy](https://github.com/Ahmedsultan09/scanfit/blob/main/SECURITY.md)

MIT licensed. Public reports and fixtures must use synthetic, licensed or fully redacted documents.
