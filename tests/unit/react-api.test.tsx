import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  Camera,
  CornerEditor,
  DocumentScanner,
  ExportReview,
  ProcessedPreview,
  defaultMessages,
} from "../../packages/scanfit/src/react";
import { ScannerTrigger } from "../../packages/scanfit/src/trigger";
import { FULL_QUAD, type ExportReport, type ScanPage } from "../../packages/scanfit/src/core";

const page: ScanPage = {
  id: "page-1",
  width: 1200,
  height: 1600,
  sourceBytes: 1000,
  preview: new Blob(["preview"], { type: "image/jpeg" }),
  thumbnail: new Blob(["thumbnail"], { type: "image/jpeg" }),
  warnings: [],
  edits: { corners: FULL_QUAD, rotation: 0, filter: "natural" },
};

const report: ExportReport = {
  bytes: 900,
  maxBytes: 1000,
  pageSize: "a4",
  pages: [
    {
      id: page.id,
      imageBytes: 700,
      width: 1200,
      height: 1600,
      quality: 0.8,
      attempts: 2,
      warnings: [],
      preview: page.preview,
    },
  ],
  limits: { minQuality: 0.65, minLongEdge: 1600, maxEncodesPerPage: 12 },
};

describe("React customization API", () => {
  it("applies stable part classes, attributes, controlled values, and slots", () => {
    const html = renderToStaticMarkup(
      <DocumentScanner
        maxBytes={2_000_000}
        onComplete={() => {}}
        className="host-scanner"
        classNames={{ header: "host-header", primaryAction: "host-primary" }}
        style={{ "--host-accent": "purple" } as React.CSSProperties}
        slotProps={{
          root: { "aria-label": "Identity document scanner", "data-host": "portal" },
          empty: { "data-empty-state": "ready" },
        }}
        pageSize="letter"
        editorView="preview"
        slots={{
          empty: (context, defaultContent) => (
            <div data-page-size={context.pageSize} data-editor-view={context.editorView}>
              {defaultContent}
            </div>
          ),
        }}
      />,
    );

    expect(html).toContain('class="sf-scanner host-scanner"');
    expect(html).toContain('aria-label="Identity document scanner"');
    expect(html).toContain('data-host="portal"');
    expect(html).toContain('class="sf-header host-header"');
    expect(html).toContain('class="sf-primary host-primary"');
    expect(html).toContain('data-empty-state="ready"');
    expect(html).toContain('data-page-size="letter"');
    expect(html).toContain('data-editor-view="preview"');
  });

  it("exports composable camera, crop, preview, and review primitives", () => {
    const fakeSession = {
      renderPage: async () => page.preview,
    } as unknown as Parameters<typeof ProcessedPreview>[0]["session"];

    const html = renderToStaticMarkup(
      <>
        <Camera
          messages={defaultMessages}
          onCapture={() => {}}
          onClose={() => {}}
          className="host-camera"
        />
        <CornerEditor
          page={page}
          messages={defaultMessages}
          onApply={() => {}}
          className="host-crop"
        />
        <ProcessedPreview
          session={fakeSession}
          page={page}
          messages={defaultMessages}
          className="host-preview"
        />
        <ExportReview
          report={report}
          ready
          messages={defaultMessages}
          onBack={() => {}}
          onConfirm={() => {}}
          className="host-review"
        />
      </>,
    );

    expect(html).toContain("sf-primitive sf-camera host-camera");
    expect(html).toContain("sf-primitive sf-crop host-crop");
    expect(html).toContain("sf-primitive sf-processed host-preview");
    expect(html).toContain("sf-primitive sf-review host-review");
  });

  it("customizes the lazy trigger without loading the scanner", () => {
    const html = renderToStaticMarkup(
      <ScannerTrigger
        maxBytes={2_000_000}
        onComplete={() => {}}
        triggerProps={{ className: "portal-trigger", "aria-label": "Open scanner" }}
        renderTrigger={(context, defaultTrigger) => (
          <div data-open={context.open}>{defaultTrigger}</div>
        )}
      >
        Add paperwork
      </ScannerTrigger>,
    );

    expect(html).toContain('class="portal-trigger"');
    expect(html).toContain('aria-label="Open scanner"');
    expect(html).toContain("Add paperwork");
    expect(html).toContain('data-open="false"');
  });
});
