# @scanfit/browser

Turn camera captures or image files into an inspected PDF that fits a byte limit. Processing stays in the browser; ScanFit does not upload documents or require a backend.

> Public alpha: test the exported pixels and your target devices before using ScanFit in a production document workflow.

## Install

```sh
npm install @scanfit/browser@next
```

React is an optional peer dependency. Install React 18.2 or 19 when using the ready-made interface.

## React scanner

```tsx
import { DocumentScanner } from "@scanfit/browser/react";
import "@scanfit/browser/styles.css";

export function ApplicationDocuments() {
  return (
    <DocumentScanner
      maxBytes={2_000_000}
      onComplete={({ file, report }) => {
        // Called after the user inspects and confirms the exported PDF.
        attachToForm(file, report);
      }}
    />
  );
}
```

Use `@scanfit/browser/trigger` for a small lazy-loaded dialog launcher, or `useScanSession` for a headless React integration.

## Framework-independent core

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

## What it provides

- JPEG, PNG and WebP import plus manual camera capture.
- Independent document-edge detection with manual corner correction.
- Rotation, natural color, grayscale and contrast adjustments.
- Page removal and reordering with drag-free controls.
- A bounded compression search and exact completed-PDF byte check.
- Per-page byte diagnostics and previews of the compressed pixels embedded in the PDF.
- Worker processing, cancellation, stale-job protection and resource cleanup.
- Replaceable detector and framework-independent TypeScript interfaces.

ScanFit returns `cannot-fit` when the configured quality and resolution floors cannot meet the requested limit. It does not silently omit pages, cross those floors, or switch color modes.

## Current limits

The alpha creates image-only PDFs. It does not include HEIC conversion, existing-PDF import, OCR, searchable or tagged PDFs, redaction, automatic capture, document persistence, telemetry or uploads. Camera behavior and performance still require validation on your supported physical devices.

## Documentation

- [Complete usage and API guide](https://github.com/Ahmedsultan09/scanfit#readme)
- [Independent detector design](https://github.com/Ahmedsultan09/scanfit/blob/main/docs/DETECTOR.md)
- [Verification evidence](https://github.com/Ahmedsultan09/scanfit/blob/main/docs/VERIFICATION.md)
- [Release checklist](https://github.com/Ahmedsultan09/scanfit/blob/main/docs/RELEASE_CHECKLIST.md)
- [Runnable framework examples](https://github.com/Ahmedsultan09/scanfit/tree/main/examples)
- [Security policy](https://github.com/Ahmedsultan09/scanfit/blob/main/SECURITY.md)

MIT licensed. Public reports and fixtures must use synthetic, licensed or fully redacted documents.
