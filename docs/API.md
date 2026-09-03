# Public API examples

This guide covers every supported package entry point. Start with `DocumentScanner` unless you need to own the interface. Move down to the React hook or core session only when the host application needs that control.

## Install

```sh
npm install @scanfit/browser@next
```

React 18.2 or 19 is a peer dependency only when an application imports `@scanfit/browser/react` or `@scanfit/browser/trigger`.

## Entry points

| Import | Use it for |
| --- | --- |
| `@scanfit/browser/react` | The complete scanner, composable React primitives, messages, and the headless hook |
| `@scanfit/browser/trigger` | A small button that lazy-loads the scanner into a native dialog |
| `@scanfit/browser/core` | Framework-independent session state and processing coordination |
| `@scanfit/browser/detector` | Direct access to the built-in classical detector and detector types |
| `@scanfit/browser/pdf` | Low-level PDF construction and size fitting for custom processing pipelines |
| `@scanfit/browser/styles.css` | Styles for the complete scanner and exported React primitives |

Browser work starts after a scanner session is created or a component is mounted. In SSR frameworks, mount interactive components inside the framework's client boundary.

Names such as `attachFileToForm`, `showError`, `findDocumentCorners`, and `encodeSourceAsJpeg` in the examples represent host-application code; ScanFit does not submit files or choose an upload destination.

## Complete React scanner

This example shows the main behavior, safety, localization, styling, controlled state, and event APIs together.

```tsx
import { useState, type CSSProperties } from "react";
import {
  DocumentScanner,
  type ScannerEditorView,
} from "@scanfit/browser/react";
import type {
  ExportResult,
  PageSize,
  ScanPage,
} from "@scanfit/browser/core";
import "@scanfit/browser/styles.css";

export function ApplicationScanner() {
  const [pageSize, setPageSize] = useState<PageSize>("a4");
  const [selectedPageId, setSelectedPageId] = useState("");
  const [editorView, setEditorView] =
    useState<ScannerEditorView>("crop");
  const [pages, setPages] = useState<readonly ScanPage[]>([]);
  const [result, setResult] = useState<ExportResult | null>(null);

  return (
    <DocumentScanner
      maxBytes={2_000_000}
      qualityLimits={{ minQuality: 0.65, minLongEdge: 1600 }}
      options={{
        limits: {
          maxPages: 12,
          maxFileBytes: 20 * 1024 * 1024,
          maxPixels: 20_000_000,
          maxSessionBytes: 80 * 1024 * 1024,
        },
        detector: "auto",
        detectorOptions: {
          minConfidence: 0.5,
          maxComponents: 8,
          maxCandidates: 32,
        },
      }}
      pageSize={pageSize}
      onPageSizeChange={setPageSize}
      selectedPageId={selectedPageId}
      onSelectedPageIdChange={setSelectedPageId}
      editorView={editorView}
      onEditorViewChange={setEditorView}
      onPagesChange={setPages}
      onStatusChange={(status) => console.log("scanner status", status)}
      onProgress={(progress) => console.log("progress", progress)}
      onResultChange={(nextResult) => {
        setResult(nextResult);
        if (nextResult?.status === "cannot-fit") {
          console.log("smallest measured PDF", nextResult.candidateBytes);
        }
      }}
      messages={{
        title: "Attach your documents",
        subtitle: "Review every page before it is added to your application.",
      }}
      dir="ltr"
      className="application-scanner"
      style={{ "--sf-accent": "#4338ca" } as CSSProperties}
      classNames={{
        header: "application-scanner__header",
        primaryAction: "application-scanner__primary",
      }}
      slotProps={{
        root: { "aria-label": "Application document scanner" },
        pageList: { "data-testid": "document-pages" },
      }}
      slots={{
        toolbar: (context, defaultToolbar) => (
          <div className="application-toolbar">
            {defaultToolbar}
            <output>{context.pages.length} pages accepted</output>
          </div>
        ),
        privacy: (context, defaultPrivacy) => (
          <aside data-status={context.status}>{defaultPrivacy}</aside>
        ),
      }}
      onError={(error) => console.error(error)}
      onClose={() => console.log("scanner closed")}
      onComplete={({ file, report }) => {
        // Called only after the user confirms the final preview.
        console.log(file.size, report.pages.length, pages.length, result);
        attachFileToForm(file);
      }}
    />
  );
}
```

`maxBytes` must be a positive integer number of bytes. The component does not upload the returned `File`; the host application decides whether to keep, download, or submit it.

Supply an existing session when several host components need to share ownership. The host must dispose that session:

```tsx
import { useEffect, useState } from "react";
import { DocumentScanner } from "@scanfit/browser/react";
import { createScanSession } from "@scanfit/browser/core";

export function SharedSessionScanner() {
  const [session] = useState(() =>
    createScanSession({ limits: { maxPages: 6 } }),
  );

  useEffect(() => () => session.dispose(), [session]);

  return (
    <DocumentScanner
      session={session}
      maxBytes={2_000_000}
      onComplete={({ file }) => attachFileToForm(file)}
    />
  );
}
```

When `session` is supplied, its configuration wins; `DocumentScanner.options` is used only when the component owns the session.

### Controlled and uncontrolled state

Use either side of each pair:

| Controlled | Uncontrolled initial value | Change callback |
| --- | --- | --- |
| `pageSize` | `defaultPageSize` | `onPageSizeChange` |
| `selectedPageId` | `defaultSelectedPageId` | `onSelectedPageIdChange` |
| `editorView` | `defaultEditorView` | `onEditorViewChange` |

Valid page sizes are `"a4"`, `"letter"`, and `"image"`. Valid editor views are `"crop"` and `"preview"`.

### Slots

A slot receives `(context, defaultContent)`. Return the default content unchanged, wrap it, or replace it. The available slots are:

```ts
type ScannerSlotName =
  | "header"
  | "error"
  | "progress"
  | "camera"
  | "empty"
  | "toolbar"
  | "workspace"
  | "pageList"
  | "editor"
  | "pageActions"
  | "footer"
  | "privacy"
  | "review";
```

The context exposes the current `session`, `pages`, `status`, `progress`, `result`, selected page and index, `pageSize`, `editorView`, `maxBytes`, `busy`, merged `messages`, and these actions:

```tsx
<DocumentScanner
  maxBytes={2_000_000}
  onComplete={handleComplete}
  slots={{
    empty: ({ actions, busy, messages }, defaultContent) => (
      <section>
        {defaultContent}
        <button disabled={busy} onClick={actions.openFilePicker}>
          {messages.choosePhotos}
        </button>
      </section>
    ),
    footer: ({ actions, pageSize }, defaultContent) => (
      <footer>
        {defaultContent}
        <button onClick={() => actions.setPageSize("letter")}>
          Current paper: {pageSize}
        </button>
        <button onClick={() => void actions.prepare()}>Prepare</button>
      </footer>
    ),
    review: ({ actions, result }, defaultContent) => (
      <section>
        {defaultContent}
        {result?.status === "ready" ? (
          <button onClick={actions.confirm}>Use the confirmed PDF</button>
        ) : null}
      </section>
    ),
  }}
/>
```

Other actions are `addFiles`, `openCamera`, `selectPage`, `setEditorView`, `updatePage`, `movePage`, `removePage`, `cancel`, and `close`.

The legacy `renderHeader` and `renderPageSummary` props remain supported:

```tsx
<DocumentScanner
  maxBytes={2_000_000}
  onComplete={handleComplete}
  renderHeader={({ pageCount, maxBytes }) => (
    <PortalHeader pageCount={pageCount} limit={maxBytes} />
  )}
  renderPageSummary={(page, index) => (
    <small>Page {index + 1}: {page.warnings.join(", ") || "ready"}</small>
  )}
/>
```

## Styling

Use a root `className` to scope overrides. `classNames` accepts `root`, every slot name, `closeButton`, `thumbnail`, and `primaryAction`. `slotProps` accepts normal HTML attributes for the root and structural slot elements. Structural elements include a stable `data-scanfit-part` attribute.

```css
.application-scanner {
  --sf-accent: #4338ca;
  --sf-accent-hover: #3730a3;
  --sf-accent-soft: #eef2ff;
  --sf-accent-overlay: #4338ca18;
  --sf-on-accent: #ffffff;
  --sf-ink: #111827;
  --sf-muted: #6b7280;
  --sf-border: #d1d5db;
  --sf-surface: #ffffff;
  --sf-subtle: #f9fafb;
  --sf-canvas: #f3f4f6;
  --sf-focus: #6366f1;
  --sf-success-soft: #ecfdf5;
  --sf-warning: #b45309;
  --sf-warning-soft: #fffbeb;
  --sf-danger: #dc2626;
  --sf-danger-strong: #991b1b;
  --sf-danger-soft: #fef2f2;
  --sf-danger-border: #fecaca;
  --sf-camera-background: #111827;
  --sf-backdrop: #111827b3;
  --sf-shadow: #11182714;
  --sf-shadow-strong: #11182770;
  --sf-dialog-shadow: #11182733;
  --sf-radius: 12px;
  --sf-control-radius: 6px;
  --sf-font: Inter, system-ui, sans-serif;
}

.application-scanner [data-scanfit-part="toolbar"] {
  position: sticky;
  top: 0;
  z-index: 1;
}
```

## Lazy scanner trigger

`ScannerTrigger` keeps the scanner and processing graph out of the initial JavaScript graph until the user opens it.

```tsx
import { ScannerTrigger } from "@scanfit/browser/trigger";
import "@scanfit/browser/styles.css";

export function AttachDocumentsButton() {
  return (
    <ScannerTrigger
      maxBytes={2_000_000}
      loadingLabel="Opening scanner…"
      triggerProps={{
        className: "attach-documents",
        "aria-label": "Open the document scanner",
      }}
      dialogProps={{
        className: "application-scanner-dialog",
        "aria-label": "Attach documents",
      }}
      onOpenChange={(open) => console.log("dialog open", open)}
      renderTrigger={(context, defaultTrigger) => (
        <span data-loading={context.loading}>{defaultTrigger}</span>
      )}
      onComplete={({ file }) => attachFileToForm(file)}
    >
      Scan documents
    </ScannerTrigger>
  );
}
```

If `renderTrigger` replaces rather than wraps `defaultTrigger`, call `context.launch()` from the replacement and attach `context.triggerRef` to the focus target when focus should return after closing.

## Headless React

`useScanSession(options, externalSession?)` returns `{ session, pages, status, progress, result, error }`. It creates and disposes an owned session unless an external session is supplied.

```tsx
import { useScanSession } from "@scanfit/browser/react";

export function HeadlessScanner() {
  const { session, pages, status, progress, result, error } = useScanSession({
    limits: { maxPages: 8 },
    detectorOptions: { minConfidence: 0.55 },
  });

  return (
    <section aria-label="Custom document scanner">
      <input
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        disabled={!session || status !== "idle"}
        onChange={(event) => {
          if (session) void session.addFiles(event.currentTarget.files ?? []);
        }}
      />

      <progress max={1} value={progress} />
      {error ? <p role="alert">{error.message}</p> : null}

      <ol>
        {pages.map((page, index) => (
          <li key={page.id}>
            Page {index + 1}
            <button
              disabled={index === 0}
              onClick={() => session?.movePage(page.id, index - 1)}
            >
              Move earlier
            </button>
            <button onClick={() => session?.removePage(page.id)}>Remove</button>
          </li>
        ))}
      </ol>

      <button
        disabled={!session || !pages.length || status !== "idle"}
        onClick={() => void session?.exportPdf({ maxBytes: 2_000_000 })}
      >
        Prepare PDF
      </button>

      {result?.status === "ready" ? (
        <button onClick={() => attachFileToForm(result.file)}>
          Use {result.file.size.toLocaleString()}-byte PDF
        </button>
      ) : null}
    </section>
  );
}
```

## Composable React primitives

The primitives accept their normal root-element attributes, including `className`, `style`, ARIA, and data attributes. Import the stylesheet for their default appearance.

```tsx
import { useState } from "react";
import {
  Camera,
  CornerEditor,
  ExportReview,
  ProcessedPreview,
  defaultMessages,
} from "@scanfit/browser/react";
import type {
  ExportResult,
  ScanPage,
  ScanSession,
} from "@scanfit/browser/core";
import "@scanfit/browser/styles.css";

export function CustomWorkflow({
  session,
  page,
  result,
}: {
  session: ScanSession;
  page: ScanPage;
  result: ExportResult | null;
}) {
  const [cameraOpen, setCameraOpen] = useState(false);
  const report =
    result && result.status !== "cancelled" ? result.report : null;

  return (
    <div>
      <button onClick={() => setCameraOpen(true)}>Use camera</button>
      {cameraOpen ? (
        <Camera
          messages={defaultMessages}
          className="custom-camera"
          primaryActionClassName="custom-primary"
          onClose={() => setCameraOpen(false)}
          onCapture={(blob) => {
            setCameraOpen(false);
            void session.addFiles([blob]);
          }}
        />
      ) : null}

      <CornerEditor
        page={page}
        messages={defaultMessages}
        disabled={session.getSnapshot().status !== "idle"}
        onApply={(corners) => session.updatePage(page.id, { corners })}
      />

      <ProcessedPreview
        session={session}
        page={page}
        messages={defaultMessages}
      />

      {report ? (
        <ExportReview
          report={report}
          ready={result?.status === "ready"}
          messages={defaultMessages}
          onBack={() => session.cancel()}
          onConfirm={() => {
            if (result?.status === "ready") attachFileToForm(result.file);
          }}
        />
      ) : null}
    </div>
  );
}
```

Primitives require a complete `ScannerMessages` dictionary. Create one by spreading `defaultMessages` when only some strings change:

```ts
const messages = {
  ...defaultMessages,
  title: "Scan identity documents",
  confirm: "Attach this PDF",
};
```

## Framework-independent session

The core is the full processing API for React, Vue, Svelte, and vanilla applications.

```ts
import {
  ScanError,
  createScanSession,
  type ExportResult,
  type ScanSnapshot,
} from "@scanfit/browser/core";

const session = createScanSession({
  detector: "auto", // Use "none" to start every page with a manual full-image crop.
  detectorOptions: { minConfidence: 0.5 },
  limits: {
    maxPages: 20,
    maxFileBytes: 25 * 1024 ** 2,
    maxPixels: 25_000_000,
    maxSessionBytes: 100 * 1024 ** 2,
  },
  // workerUrl: "/assets/my-scanfit-worker.js", // Advanced same-origin override.
});

const render = (snapshot: ScanSnapshot) => {
  console.log(snapshot.pages, snapshot.status, snapshot.progress);
  console.log(snapshot.result, snapshot.error);
};

const unsubscribe = session.subscribe(() => render(session.getSnapshot()));

try {
  const importController = new AbortController();
  const added = await session.addFiles(fileInput.files ?? [], {
    signal: importController.signal,
  });

  const first = added[0];
  if (!first) throw new Error("No image was accepted.");

  session.updatePage(first.id, {
    rotation: 90,
    filter: "natural",
    corners: first.edits.corners,
  });

  session.movePage(first.id, 0);

  const correctedPreview = await session.renderPage(first.id);
  const correctedPreviewUrl = URL.createObjectURL(correctedPreview);
  previewImage.src = correctedPreviewUrl;
  previewImage.addEventListener(
    "load",
    () => URL.revokeObjectURL(correctedPreviewUrl),
    { once: true },
  );

  const result: ExportResult = await session.exportPdf({
    maxBytes: 2_000_000,
    pageSize: "a4",
    minQuality: 0.65,
    minLongEdge: 1600,
  });

  if (result.status === "ready") {
    attachFileToForm(result.file);
    console.table(result.report.pages);
  } else if (result.status === "cannot-fit") {
    showCannotFit(result.candidateBytes, result.report);
  } else {
    console.log("Export cancelled; accepted pages remain available.");
  }

  // Atomic replacement: the old page remains if the replacement fails.
  await session.addFiles([replacementBlob], { replacePageId: first.id });

  // Remove only when the user has explicitly chosen to discard the page.
  session.removePage(first.id);
} catch (error) {
  if (error instanceof ScanError) {
    showError(error.code, error.message);
  } else {
    throw error;
  }
} finally {
  unsubscribe();
  session.dispose();
}
```

Call `session.cancel()` to stop the active import or export without disposing accepted pages. Call `dispose()` when the workflow is finished; a disposed session cannot be reused.

### Snapshot and result shapes

```ts
type ScanSnapshot = {
  pages: readonly ScanPage[];
  status: "idle" | "importing" | "exporting";
  progress: number; // 0–1
  result: ExportResult | null;
  error: ScanError | null;
};

type ExportResult =
  | { status: "ready"; file: File; report: ExportReport }
  | {
      status: "cannot-fit";
      candidateBytes: number;
      report: ExportReport;
    }
  | { status: "cancelled" };
```

Each `ScanPage` exposes its ID, oriented width and height, source byte count, preview and thumbnail blobs, warnings, detection diagnostics, and non-destructive edits. Each final `PageReport` exposes the embedded image bytes, final dimensions, JPEG quality, encoding attempt count, warnings, and the exact JPEG preview embedded in the PDF.

### Stable error codes

```ts
type ErrorCode =
  | "INVALID_INPUT"
  | "UNSUPPORTED_FORMAT"
  | "LIMIT_EXCEEDED"
  | "INVALID_CORNERS"
  | "PROCESSING_FAILED"
  | "UNSUPPORTED_BROWSER"
  | "DISPOSED"
  | "CAMERA_UNAVAILABLE";
```

Use the code for program logic and the message for diagnostics. Host applications should localize their own error presentation.

## Core utilities

The core entry point also exports safe image-header inspection and crop helpers.

```ts
import {
  DEFAULT_LIMITS,
  FULL_QUAD,
  ScanError,
  abortIfNeeded,
  asScanError,
  copyQuad,
  inspectImageBytes,
  validateQuad,
} from "@scanfit/browser/core";

const bytes = new Uint8Array(await imageFile.arrayBuffer());
const header = inspectImageBytes(bytes);
console.log(header.width, header.height, header.orientation, header.mime);

const corners = copyQuad(FULL_QUAD);
corners[0] = { x: 0.05, y: 0.04 };
validateQuad(corners); // Throws ScanError with INVALID_CORNERS when invalid.

const controller = new AbortController();
abortIfNeeded(controller.signal);

try {
  validateQuad(corners);
} catch (error) {
  const scanError: ScanError = asScanError(error);
  console.error(scanError.code, scanError.message);
}

console.log(DEFAULT_LIMITS);
```

`inspectImageBytes` recognizes still JPEG, PNG, and WebP headers. It does not decode the image or apply the session's byte and pixel limits.

## Detector API

Use the detector entry point directly for testing or a custom processing pipeline:

```ts
import { createDetector } from "@scanfit/browser/detector";

const detector = createDetector({
  minConfidence: 0.55,
  maxComponents: 8,
  maxCandidates: 32,
});

const detection = await detector.detect(imageData);

if (detection.corners) {
  console.log("normalized corners", detection.corners);
  console.log("confidence", detection.confidence);
  console.log("evidence", detection.diagnostics);
} else {
  showManualCrop();
}
```

To replace detection inside `createScanSession`, build a same-origin ES module that exports `createDetector()`:

```ts
// my-detector.ts — bundle this to a same-origin browser module.
import type {
  DetectionResult,
  DocumentDetector,
} from "@scanfit/browser/detector";

export function createDetector(): DocumentDetector {
  return {
    async detect(image: ImageData): Promise<DetectionResult> {
      const corners = await findDocumentCorners(image);
      return {
        corners,
        confidence: corners ? 0.8 : 0,
        diagnostics: {
          engine: "my-detector",
          confidence: corners ? 0.8 : 0,
          candidateCount: corners ? 1 : 0,
          edgeThreshold: 0,
          edgeDensity: 0,
          durationMs: 0,
          coverage: 0,
          edgeSupport: 0,
          contrast: 0,
          rectangularity: 0,
          fallbackReason: corners ? undefined : "no-candidate",
        },
      };
    },
  };
}
```

```ts
import { createScanSession } from "@scanfit/browser/core";

const session = createScanSession({
  detectorModule: "/assets/my-detector.js",
});
```

The module URL must resolve to the current page's origin. Detector coordinates are normalized to `[0, 1]` in clockwise top-left, top-right, bottom-right, bottom-left order.

## Low-level PDF API

Most applications should call `session.exportPdf()`. The PDF entry point exists for hosts building a different image-processing pipeline.

```ts
import {
  buildPdf,
  fitPdf,
  validateExportOptions,
  type EncodedPage,
  type PdfEncoder,
  type PdfPageSource,
} from "@scanfit/browser/pdf";

const options = {
  maxBytes: 2_000_000,
  pageSize: "a4" as const,
  minQuality: 0.65,
  minLongEdge: 1600,
};

validateExportOptions(options);

const encodedPages: EncodedPage[] = await encodeInitialJpegs();
const pdfBlob = await buildPdf(encodedPages, options.pageSize);

const sources: PdfPageSource[] = encodedPages.map((page) => ({
  id: page.id,
  warnings: page.warnings,
}));

const encoder: PdfEncoder = {
  async encode(index, longEdge, quality) {
    // The host supplies this implementation and must return a valid JPEG.
    return encodeSourceAsJpeg(index, { longEdge, quality });
  },
};

const fitted = await fitPdf(sources, encoder, options, (progress) => {
  console.log("PDF fitting progress", progress);
});

if (fitted.status === "ready") {
  console.log(fitted.blob.size, fitted.report);
} else {
  console.log("bounded search could not fit", fitted.report);
}
```

`buildPdf` embeds valid JPEG blobs without stretching them. `fitPdf` runs the same bounded, measured strategy used by the session workflow. A `cannot-fit` result means the configured search did not fit; it is not a mathematical proof that no encoding could fit.

## Messages and byte formatting

```ts
import {
  defaultMessages,
  formatBytes,
  type ScannerMessages,
} from "@scanfit/browser/react";

const messages: ScannerMessages = {
  ...defaultMessages,
  title: "Scan supporting documents",
  confirm: "Attach PDF",
};

console.log(formatBytes(2_000_000)); // "2.00 MB"
```

`DocumentScanner.messages` accepts a partial dictionary. The standalone primitives require the complete dictionary because they do not merge defaults themselves.

## Resource ownership

- Revoke object URLs created by host code.
- Dispose owned core sessions when the workflow ends.
- Do not dispose a session while the user still needs to edit or inspect its report previews.
- `DocumentScanner` disposes only the session it creates. It does not dispose a session supplied through `session`.
- `useScanSession` follows the same owned-versus-external rule.
- The camera component stops tracks after capture, close, unmount, or when the document becomes hidden.
- Neither the components nor core submit documents to a network endpoint.
