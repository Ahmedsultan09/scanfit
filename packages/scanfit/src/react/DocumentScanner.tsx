import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  type ScanSession,
  type SessionOptions,
  type ScanPage,
  type ExportReport,
  type PageSize,
  type Warning,
} from "../core";
import { useObjectUrl, useScanSession } from "./hooks";
import { defaultMessages, formatBytes, type ScannerMessages } from "./messages";
import { CornerEditor } from "./CornerEditor";
import { Camera } from "./Camera";
import "./styles.css";

export interface DocumentScannerProps {
  maxBytes: number;
  onComplete: (result: { file: File; report: ExportReport }) => void;
  onClose?: () => void;
  onError?: (error: Error) => void;
  session?: ScanSession;
  options?: SessionOptions;
  qualityLimits?: { minQuality?: number; minLongEdge?: number };
  messages?: Partial<ScannerMessages>;
  dir?: "ltr" | "rtl";
  className?: string;
  renderHeader?: (context: {
    pageCount: number;
    maxBytes: number;
  }) => ReactNode;
  renderPageSummary?: (page: ScanPage, index: number) => ReactNode;
}
const warningKey: Record<Warning, keyof ScannerMessages> = {
  "manual-crop": "manualCrop",
  "detection-unavailable": "detectorUnavailable",
  "possibly-blurry": "blurry",
  "possibly-dark": "dark",
  "low-resolution": "lowResolution",
};

function Thumbnail({
  page,
  index,
  selected,
  onSelect,
  m,
}: {
  page: ScanPage;
  index: number;
  selected: boolean;
  onSelect: () => void;
  m: ScannerMessages;
}) {
  const url = useObjectUrl(page.thumbnail);
  return (
    <button
      type="button"
      className={`sf-thumbnail ${selected ? "sf-current" : ""}`}
      aria-pressed={selected}
      aria-label={`${m.page} ${index + 1}`}
      onClick={onSelect}
    >
      {url ? <img src={url} alt="" /> : null}
      <span>{String(index + 1).padStart(2, "0")}</span>
    </button>
  );
}
function ProcessedPreview({
  session,
  page,
  m,
}: {
  session: ScanSession;
  page: ScanPage;
  m: ScannerMessages;
}) {
  const [blob, setBlob] = useState<Blob | null>(null),
    [error, setError] = useState("");
  const url = useObjectUrl(blob);
  useEffect(() => {
    const controller = new AbortController();
    setBlob(null);
    setError("");
    void session
      .renderPage(page.id, controller.signal)
      .then((result) => {
        if (!controller.signal.aborted) setBlob(result);
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message);
      });
    return () => controller.abort();
  }, [
    session,
    page.id,
    page.edits.corners,
    page.edits.filter,
    page.edits.rotation,
  ]);
  return (
    <div className="sf-processed">
      {error ? (
        <p role="alert">{error}</p>
      ) : url ? (
        <img src={url} alt={m.correctedPreview} />
      ) : (
        <p role="status">{m.preparing}</p>
      )}
    </div>
  );
}
function ExportReview({
  report,
  ready,
  onBack,
  onConfirm,
  m,
}: {
  report: ExportReport;
  ready: boolean;
  onBack: () => void;
  onConfirm: () => void;
  m: ScannerMessages;
}) {
  const [index, setIndex] = useState(0),
    [zoom, setZoom] = useState(100),
    heading = useRef<HTMLHeadingElement>(null);
  const selected = report.pages[index] ?? report.pages[0],
    url = useObjectUrl(selected.preview);
  useEffect(() => heading.current?.focus(), []);
  return (
    <section className="sf-review">
      <div className={`sf-result-banner ${ready ? "" : "sf-warning"}`}>
        <span className="sf-result-icon" aria-hidden="true">
          {ready ? "✓" : "!"}
        </span>
        <div>
          <h3 tabIndex={-1} ref={heading}>
            {ready ? m.reviewTitle : m.cannotFitTitle}
          </h3>
          <p>{ready ? m.reviewDescription : m.cannotFitDescription}</p>
        </div>
      </div>
      <div className="sf-review-layout">
        <div className="sf-final-stage">
          <div className="sf-section-heading">
            <label>
              {m.page}{" "}
              <select
                value={index}
                onChange={(e) => setIndex(Number(e.target.value))}
              >
                {report.pages.map((page, i) => (
                  <option key={page.id} value={i}>
                    {i + 1}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {m.zoom}{" "}
              <select
                value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
              >
                {[100, 150, 200, 300].map((value) => (
                  <option key={value} value={value}>
                    {value}%
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="sf-zoom-viewport">
            {url ? (
              <img
                src={url}
                alt={`${m.correctedPreview} ${index + 1}`}
                style={{ width: `${zoom}%`, maxWidth: "none" }}
              />
            ) : null}
          </div>
        </div>
        <aside className="sf-report">
          <div className="sf-size-number">{formatBytes(report.bytes)}</div>
          <p>
            {m.actualSize}: {report.bytes.toLocaleString()} B<br />
            {m.limit}: {report.maxBytes.toLocaleString()} B
          </p>
          <div className="sf-budget-track">
            <span
              style={{
                width: `${Math.min(100, (report.bytes / report.maxBytes) * 100)}%`,
              }}
            />
          </div>
          <h4>{m.imageBytes}</h4>
          <ol>
            {report.pages.map((page, i) => (
              <li key={page.id}>
                <button type="button" onClick={() => setIndex(i)}>
                  {m.page} {i + 1}
                </button>
                <span>{page.imageBytes.toLocaleString()} B</span>
              </li>
            ))}
          </ol>
          <dl>
            <dt>{m.dimensions}</dt>
            <dd>
              {selected.width} × {selected.height}
            </dd>
            <dt>{m.quality}</dt>
            <dd>{Math.round(selected.quality * 100)}%</dd>
            <dt>{m.qualityFloor}</dt>
            <dd>{Math.round(report.limits.minQuality * 100)}%</dd>
            <dt>{m.resolutionFloor}</dt>
            <dd>{report.limits.minLongEdge} px</dd>
          </dl>
          <p className="sf-hint">{m.qualityNote}</p>
          {selected.warnings.map((w) => (
            <p className="sf-hint" key={w}>
              {m[warningKey[w]]}
            </p>
          ))}
        </aside>
      </div>
      <div className="sf-footer">
        <button type="button" onClick={onBack}>
          {m.back}
        </button>
        {ready ? (
          <button type="button" className="sf-primary" onClick={onConfirm}>
            {m.confirm} <span aria-hidden="true">↗</span>
          </button>
        ) : null}
      </div>
    </section>
  );
}

export function DocumentScanner(props: DocumentScannerProps) {
  const {
    session: external,
    options,
    maxBytes,
    onComplete,
    onClose,
    onError,
    dir = "ltr",
    className = "",
  } = props;
  const m = useMemo(
    () => ({ ...defaultMessages, ...props.messages }),
    [props.messages],
  );
  const { session, pages, status, progress, result } = useScanSession(
    options,
    external,
  );
  const [selectedId, setSelectedId] = useState(""),
    [tab, setTab] = useState<"crop" | "preview">("crop"),
    [camera, setCamera] = useState(false),
    [error, setError] = useState(""),
    [pageSize, setPageSize] = useState<PageSize>("a4");
  const [replacement, setReplacement] = useState<string | undefined>();
  const input = useRef<HTMLInputElement>(null),
    replaceInput = useRef<HTMLInputElement>(null),
    titleId = useId();
  const busy = status !== "idle",
    page = pages.find((p) => p.id === selectedId) ?? pages[0],
    index = page ? pages.indexOf(page) : -1;
  const validLimit = Number.isSafeInteger(maxBytes) && maxBytes > 0;
  const minQuality = props.qualityLimits?.minQuality,
    minLongEdge = props.qualityLimits?.minLongEdge;
  useEffect(() => {
    session?.cancel();
  }, [session, maxBytes, minQuality, minLongEdge]);
  function fail(value: unknown) {
    const e = value instanceof Error ? value : new Error(String(value));
    setError(e.message);
    onError?.(e);
  }
  async function add(files: Iterable<Blob>, replacePageId?: string) {
    if (!session) return;
    setError("");
    setCamera(false);
    setTab("crop");
    try {
      const added = await session.addFiles(files, { replacePageId });
      if (added.length) setSelectedId(added[added.length - 1].id);
    } catch (e) {
      fail(e);
    } finally {
      setReplacement(undefined);
    }
  }
  function edit(action: () => void) {
    setError("");
    try {
      action();
    } catch (e) {
      fail(e);
    }
  }
  function close() {
    if (!pages.length || window.confirm(m.discard)) onClose?.();
  }
  async function prepare() {
    if (!session || !validLimit) return;
    setTab("crop");
    setError("");
    try {
      await session.exportPdf({ maxBytes, pageSize, minQuality, minLongEdge });
    } catch (e) {
      fail(e);
    }
  }
  const report = result && result.status !== "cancelled" ? result.report : null;
  return (
    <section
      className={`sf-scanner ${className}`}
      dir={dir}
      aria-labelledby={titleId}
    >
      <header className="sf-header">
        {props.renderHeader ? (
          <div>
            <h2 id={titleId} className="sf-file-input">
              {m.title}
            </h2>
            {props.renderHeader({ pageCount: pages.length, maxBytes })}
          </div>
        ) : (
          <div>
            <h2 id={titleId}>{m.title}</h2>
            <p>{m.subtitle}</p>
          </div>
        )}
        {onClose ? (
          <button
            type="button"
            className="sf-icon-button"
            aria-label={m.close}
            onClick={close}
          >
            ×
          </button>
        ) : null}
      </header>
      <input
        ref={input}
        className="sf-file-input"
        tabIndex={-1}
        aria-hidden="true"
        aria-label={m.addPhotos}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          e.target.value = "";
          void add(files);
        }}
      />
      <input
        ref={replaceInput}
        className="sf-file-input"
        tabIndex={-1}
        aria-hidden="true"
        aria-label={m.retake}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        capture="environment"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          e.target.value = "";
          if (files.length) void add(files, replacement);
        }}
      />
      {error ? (
        <div className="sf-error" role="alert">
          {error}
        </div>
      ) : null}
      {!validLimit ? (
        <div className="sf-error" role="alert">
          {m.invalidLimit}
        </div>
      ) : null}
      {busy ? (
        <div className="sf-progress" role="status">
          <div>
            <span>{status === "importing" ? m.importing : m.preparing}</span>
            <button type="button" onClick={() => session?.cancel()}>
              {m.cancel}
            </button>
          </div>
          <progress max={1} value={progress} />
        </div>
      ) : null}
      {camera ? (
        <Camera
          messages={m}
          onClose={() => setCamera(false)}
          onCapture={(file) => void add([file], replacement)}
        />
      ) : report ? (
        <ExportReview
          report={report}
          ready={result?.status === "ready" && result.file.size <= maxBytes}
          m={m}
          onBack={() => session?.cancel()}
          onConfirm={() => {
            if (result?.status === "ready" && result.file.size <= maxBytes)
              onComplete({ file: result.file, report: result.report });
          }}
        />
      ) : !pages.length ? (
        <div
          className="sf-empty"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            if (!busy) void add(Array.from(e.dataTransfer.files));
          }}
        >
          <div className="sf-paper-illustration" aria-hidden="true">
            <span />
            <span />
            <span />
            <span />
            <i>+</i>
          </div>
          <h3>{m.emptyTitle}</h3>
          <p>{m.emptyDescription}</p>
          <div className="sf-empty-actions">
            <button
              type="button"
              className="sf-primary"
              disabled={!session || busy}
              onClick={() => input.current?.click()}
            >
              {m.choosePhotos} <span aria-hidden="true">↑</span>
            </button>
            <button
              type="button"
              disabled={!session || busy}
              onClick={() => {
                setReplacement(undefined);
                setCamera(true);
              }}
            >
              {m.camera}
            </button>
          </div>
          <small>{m.formats}</small>
        </div>
      ) : (
        <>
          <div className="sf-toolbar">
            <div className="sf-count">
              {pages.length} {m.pages.toLowerCase()}
            </div>
            <div>
              <button
                type="button"
                disabled={busy}
                onClick={() => input.current?.click()}
              >
                + {m.addPhotos}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  setReplacement(undefined);
                  setCamera(true);
                }}
              >
                {m.camera}
              </button>
            </div>
          </div>
          <div className="sf-workspace">
            <aside className="sf-pages" aria-label={m.pages}>
              {pages.map((p, i) => (
                <div key={p.id}>
                  <Thumbnail
                    page={p}
                    index={i}
                    selected={p.id === page?.id}
                    onSelect={() => {
                      setSelectedId(p.id);
                      setTab("crop");
                    }}
                    m={m}
                  />
                  {props.renderPageSummary?.(p, i)}
                </div>
              ))}
            </aside>
            <div className="sf-editor">
              {page && session ? (
                <>
                  <div className="sf-editor-heading">
                    <div className="sf-tabs" role="group" aria-label={m.page}>
                      <button
                        type="button"
                        aria-pressed={tab === "crop"}
                        onClick={() => setTab("crop")}
                      >
                        {m.edit}
                      </button>
                      <button
                        type="button"
                        aria-pressed={tab === "preview"}
                        disabled={busy}
                        onClick={() => setTab("preview")}
                      >
                        {m.preview}
                      </button>
                    </div>
                    <span>
                      {m.page} {index + 1}
                    </span>
                  </div>
                  {tab === "crop" ? (
                    <CornerEditor
                      key={page.id}
                      page={page}
                      disabled={busy}
                      messages={m}
                      onApply={(corners) =>
                        edit(() => session.updatePage(page.id, { corners }))
                      }
                    />
                  ) : (
                    <ProcessedPreview session={session} page={page} m={m} />
                  )}
                  <div className="sf-page-actions">
                    <label>
                      {m.filter}
                      <select
                        value={page.edits.filter}
                        disabled={busy}
                        onChange={(e) =>
                          edit(() =>
                            session.updatePage(page.id, {
                              filter: e.target.value as
                                | "natural"
                                | "grayscale"
                                | "contrast",
                            }),
                          )
                        }
                      >
                        <option value="natural">{m.natural}</option>
                        <option value="grayscale">{m.grayscale}</option>
                        <option value="contrast">{m.contrast}</option>
                      </select>
                    </label>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        edit(() =>
                          session.updatePage(page.id, {
                            rotation: ((page.edits.rotation + 90) % 360) as
                              | 0
                              | 90
                              | 180
                              | 270,
                          }),
                        )
                      }
                    >
                      {m.rotate}
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        setReplacement(page.id);
                        replaceInput.current?.click();
                      }}
                    >
                      {m.retake}
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      aria-label={m.moveUp}
                      onClick={() =>
                        edit(() => session.movePage(page.id, index - 1))
                      }
                      hidden={index === 0}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      aria-label={m.moveDown}
                      onClick={() =>
                        edit(() => session.movePage(page.id, index + 1))
                      }
                      hidden={index === pages.length - 1}
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      className="sf-danger"
                      disabled={busy}
                      onClick={() => {
                        if (window.confirm(m.removeConfirm))
                          edit(() => session.removePage(page.id));
                      }}
                    >
                      {m.remove}
                    </button>
                  </div>
                  {page.warnings.map((w) => (
                    <p key={w} className="sf-hint">
                      {m[warningKey[w]]}
                    </p>
                  ))}
                </>
              ) : null}
            </div>
          </div>
          <footer className="sf-footer">
            <label>
              {m.pageSize}
              <select
                value={pageSize}
                disabled={busy}
                onChange={(e) => setPageSize(e.target.value as PageSize)}
              >
                <option value="a4">{m.a4}</option>
                <option value="letter">{m.letter}</option>
                <option value="image">{m.image}</option>
              </select>
            </label>
            <div className="sf-export-actions">
              <span>
                {m.limit}: <strong>{formatBytes(maxBytes)}</strong>
              </span>
              <button
                type="button"
                className="sf-primary"
                disabled={busy || !validLimit}
                onClick={() => void prepare()}
              >
                {m.prepare} <span aria-hidden="true">→</span>
              </button>
            </div>
          </footer>
        </>
      )}
      <div className="sf-privacy">
        <span aria-hidden="true">◈</span> {m.privacy}
        <small>{m.noRecovery}</small>
      </div>
    </section>
  );
}
