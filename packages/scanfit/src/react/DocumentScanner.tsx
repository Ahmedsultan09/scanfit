import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type HTMLAttributes,
  type ReactNode,
} from "react";
import {
  type ScanSession,
  type SessionOptions,
  type ScanPage,
  type ScanSnapshot,
  type ExportReport,
  type ExportResult,
  type PageEdits,
  type PageSize,
  type Warning,
} from "../core";
import { useObjectUrl, useScanSession } from "./hooks";
import { defaultMessages, formatBytes, type ScannerMessages } from "./messages";
import { CornerEditor } from "./CornerEditor";
import { Camera } from "./Camera";
import "./styles.css";

export type ScannerEditorView = "crop" | "preview";

export type ScannerPart =
  | "root"
  | "header"
  | "closeButton"
  | "error"
  | "progress"
  | "camera"
  | "empty"
  | "toolbar"
  | "workspace"
  | "pageList"
  | "thumbnail"
  | "editor"
  | "pageActions"
  | "footer"
  | "privacy"
  | "review"
  | "primaryAction";

export type ScannerSlotName = Exclude<
  ScannerPart,
  "root" | "closeButton" | "thumbnail" | "primaryAction"
>;

export type ScannerSlotProps = Omit<HTMLAttributes<HTMLElement>, "children"> & {
  [attribute: `data-${string}`]: string | number | boolean | undefined;
};

export interface ScannerSlotContext {
  session: ScanSession | null;
  pages: readonly ScanPage[];
  status: ScanSnapshot["status"];
  progress: number;
  result: ExportResult | null;
  selectedPage: ScanPage | undefined;
  selectedIndex: number;
  pageSize: PageSize;
  editorView: ScannerEditorView;
  maxBytes: number;
  busy: boolean;
  messages: ScannerMessages;
  actions: {
    addFiles(files: Iterable<Blob>, replacePageId?: string): Promise<void>;
    openFilePicker(): void;
    openCamera(replacePageId?: string): void;
    selectPage(pageId: string): void;
    setEditorView(view: ScannerEditorView): void;
    setPageSize(pageSize: PageSize): void;
    updatePage(pageId: string, edits: Partial<PageEdits>): void;
    movePage(pageId: string, index: number): void;
    removePage(pageId: string): void;
    prepare(): Promise<void>;
    cancel(): void;
    close(): void;
    confirm(): void;
  };
}

export type ScannerSlotRenderer = (
  context: ScannerSlotContext,
  defaultContent: ReactNode,
) => ReactNode;

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
  style?: CSSProperties;
  /** Stable classes for styling individual scanner parts. */
  classNames?: Partial<Record<ScannerPart, string>>;
  /** Attributes applied to structural parts of the built-in interface. */
  slotProps?: Partial<Record<ScannerSlotName | "root", ScannerSlotProps>>;
  /** Replace a built-in section while retaining access to its default content. */
  slots?: Partial<Record<ScannerSlotName, ScannerSlotRenderer>>;
  pageSize?: PageSize;
  defaultPageSize?: PageSize;
  onPageSizeChange?: (pageSize: PageSize) => void;
  selectedPageId?: string;
  defaultSelectedPageId?: string;
  onSelectedPageIdChange?: (pageId: string) => void;
  editorView?: ScannerEditorView;
  defaultEditorView?: ScannerEditorView;
  onEditorViewChange?: (view: ScannerEditorView) => void;
  onPagesChange?: (pages: readonly ScanPage[]) => void;
  onStatusChange?: (status: ScanSnapshot["status"]) => void;
  onProgress?: (progress: number) => void;
  onResultChange?: (result: ExportResult | null) => void;
  renderHeader?: (context: {
    pageCount: number;
    maxBytes: number;
  }) => ReactNode;
  renderPageSummary?: (page: ScanPage, index: number) => ReactNode;
}

function joinClasses(...values: Array<string | undefined>) {
  return values.filter(Boolean).join(" ");
}

function useControllableState<T>(
  value: T | undefined,
  defaultValue: T,
  onChange: ((value: T) => void) | undefined,
) {
  const [internal, setInternal] = useState(defaultValue);
  const current = value === undefined ? internal : value;
  const set = useCallback(
    (next: T) => {
      if (Object.is(current, next)) return;
      if (value === undefined) setInternal(next);
      onChange?.(next);
    },
    [current, onChange, value],
  );
  return [current, set] as const;
}

function useChangeEffect<T>(
  value: T,
  onChange: ((value: T) => void) | undefined,
) {
  const previous = useRef(value);
  useEffect(() => {
    if (Object.is(previous.current, value)) return;
    previous.current = value;
    onChange?.(value);
  }, [onChange, value]);
}

function samePages(left: readonly ScanPage[], right: readonly ScanPage[]) {
  if (left.length !== right.length) return false;
  return left.every((page, index) => {
    const other = right[index];
    return (
      page.id === other.id &&
      page.width === other.width &&
      page.height === other.height &&
      page.sourceBytes === other.sourceBytes &&
      page.preview === other.preview &&
      page.thumbnail === other.thumbnail &&
      page.edits.rotation === other.edits.rotation &&
      page.edits.filter === other.edits.filter &&
      page.warnings.join("|") === other.warnings.join("|") &&
      page.edits.corners.every(
        (point, pointIndex) =>
          point.x === other.edits.corners[pointIndex].x &&
          point.y === other.edits.corners[pointIndex].y,
      )
    );
  });
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
  className,
}: {
  page: ScanPage;
  index: number;
  selected: boolean;
  onSelect: () => void;
  m: ScannerMessages;
  className?: string;
}) {
  const url = useObjectUrl(page.thumbnail);
  return (
    <button
      type="button"
      className={joinClasses(
        "sf-thumbnail",
        selected ? "sf-current" : undefined,
        className,
      )}
      aria-pressed={selected}
      aria-label={`${m.page} ${index + 1}`}
      onClick={onSelect}
    >
      {url ? <img src={url} alt="" /> : null}
      <span>{String(index + 1).padStart(2, "0")}</span>
    </button>
  );
}
export interface ProcessedPreviewProps
  extends Omit<HTMLAttributes<HTMLDivElement>, "children"> {
  session: ScanSession;
  page: ScanPage;
  messages: ScannerMessages;
}

export function ProcessedPreview({
  session,
  page,
  messages: m,
  className = "",
  ...containerProps
}: ProcessedPreviewProps) {
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
    <div
      {...containerProps}
      className={joinClasses("sf-primitive", "sf-processed", className)}
    >
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
export interface ExportReviewProps
  extends Omit<HTMLAttributes<HTMLElement>, "children"> {
  report: ExportReport;
  ready: boolean;
  onBack: () => void;
  onConfirm: () => void;
  messages: ScannerMessages;
  primaryActionClassName?: string;
}

export function ExportReview({
  report,
  ready,
  onBack,
  onConfirm,
  messages: m,
  primaryActionClassName,
  className = "",
  ...sectionProps
}: ExportReviewProps) {
  const [index, setIndex] = useState(0),
    [zoom, setZoom] = useState(100),
    heading = useRef<HTMLHeadingElement>(null);
  const selected = report.pages[index] ?? report.pages[0],
    url = useObjectUrl(selected.preview);
  useEffect(() => heading.current?.focus(), []);
  return (
    <section
      {...sectionProps}
      className={joinClasses("sf-primitive", "sf-review", className)}
    >
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
          <button
            type="button"
            className={joinClasses("sf-primary", primaryActionClassName)}
            onClick={onConfirm}
          >
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
  const [selectedId, setSelectedId] = useControllableState(
      props.selectedPageId,
      props.defaultSelectedPageId ?? "",
      props.onSelectedPageIdChange,
    ),
    [tab, setTab] = useControllableState(
      props.editorView,
      props.defaultEditorView ?? "crop",
      props.onEditorViewChange,
    ),
    [pageSize, setPageSize] = useControllableState(
      props.pageSize,
      props.defaultPageSize ?? "a4",
      props.onPageSizeChange,
    ),
    [camera, setCamera] = useState(false),
    [error, setError] = useState("");
  const [replacement, setReplacement] = useState<string | undefined>();
  const input = useRef<HTMLInputElement>(null),
    replaceInput = useRef<HTMLInputElement>(null);
  const busy = status !== "idle",
    page = pages.find((p) => p.id === selectedId) ?? pages[0],
    index = page ? pages.indexOf(page) : -1;
  const validLimit = Number.isSafeInteger(maxBytes) && maxBytes > 0;
  const minQuality = props.qualityLimits?.minQuality,
    minLongEdge = props.qualityLimits?.minLongEdge;
  useEffect(() => {
    session?.cancel();
  }, [session, maxBytes, minQuality, minLongEdge]);
  const previousPages = useRef(pages);
  useEffect(() => {
    if (samePages(previousPages.current, pages)) {
      previousPages.current = pages;
      return;
    }
    previousPages.current = pages;
    props.onPagesChange?.(pages);
  }, [pages, props.onPagesChange]);
  useChangeEffect(status, props.onStatusChange);
  useChangeEffect(progress, props.onProgress);
  useChangeEffect(result, props.onResultChange);
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
      return true;
    } catch (e) {
      fail(e);
      return false;
    }
  }
  function close() {
    if (!pages.length || window.confirm(m.discard)) onClose?.();
  }
  function openCamera(replacePageId?: string) {
    setReplacement(replacePageId);
    setCamera(true);
  }
  function selectPage(pageId: string) {
    setSelectedId(pageId);
    setTab("crop");
  }
  function removePage(pageId: string) {
    if (!session) return;
    const removedIndex = pages.findIndex((item) => item.id === pageId);
    if (!edit(() => session.removePage(pageId))) return;
    if (page?.id === pageId) {
      const fallback = pages[removedIndex + 1] ?? pages[removedIndex - 1];
      setSelectedId(fallback?.id ?? "");
    }
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
  function confirm() {
    if (result?.status === "ready" && result.file.size <= maxBytes)
      onComplete({ file: result.file, report: result.report });
  }
  const report = result && result.status !== "cancelled" ? result.report : null;
  const classFor = (part: ScannerPart, base?: string) =>
    joinClasses(base, props.classNames?.[part]);
  const partProps = (part: ScannerSlotName | "root", base?: string) => {
    const configured = props.slotProps?.[part];
    return {
      ...configured,
      className: joinClasses(
        base,
        part === "root" ? className : undefined,
        props.classNames?.[part],
        configured?.className,
      ),
      style: {
        ...(part === "root" ? props.style : undefined),
        ...configured?.style,
      },
      "data-scanfit-part": part,
    };
  };
  const actions: ScannerSlotContext["actions"] = {
    addFiles: add,
    openFilePicker: () => input.current?.click(),
    openCamera,
    selectPage,
    setEditorView: setTab,
    setPageSize,
    updatePage: (pageId, edits) =>
      edit(() => session?.updatePage(pageId, edits)),
    movePage: (pageId, targetIndex) =>
      edit(() => session?.movePage(pageId, targetIndex)),
    removePage,
    prepare,
    cancel: () => session?.cancel(),
    close,
    confirm,
  };
  const slotContext: ScannerSlotContext = {
    session,
    pages,
    status,
    progress,
    result,
    selectedPage: page,
    selectedIndex: index,
    pageSize,
    editorView: tab,
    maxBytes,
    busy,
    messages: m,
    actions,
  };
  const slot = (name: ScannerSlotName, content: ReactNode) =>
    props.slots?.[name]?.(slotContext, content) ?? content;
  return (
    <section
      {...partProps("root", "sf-scanner")}
      dir={dir}
      aria-label={props.slotProps?.root?.["aria-label"] ?? m.title}
    >
      {slot("header", <header {...partProps("header", "sf-header")}>
        {props.renderHeader ? (
          <div>
            <h2 className="sf-file-input">
              {m.title}
            </h2>
            {props.renderHeader({ pageCount: pages.length, maxBytes })}
          </div>
        ) : (
          <div>
            <h2>{m.title}</h2>
            <p>{m.subtitle}</p>
          </div>
        )}
        {onClose ? (
          <button
            type="button"
            className={classFor("closeButton", "sf-icon-button")}
            aria-label={m.close}
            onClick={close}
          >
            ×
          </button>
        ) : null}
      </header>)}
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
      {error || !validLimit
        ? slot(
            "error",
            <div {...partProps("error", "sf-errors")}>
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
            </div>,
          )
        : null}
      {busy ? (
        slot("progress", <div {...partProps("progress", "sf-progress")} role="status">
          <div>
            <span>{status === "importing" ? m.importing : m.preparing}</span>
            <button type="button" onClick={() => session?.cancel()}>
              {m.cancel}
            </button>
          </div>
          <progress max={1} value={progress} />
        </div>)
      ) : null}
      {camera ? (
        slot("camera", <Camera
          {...partProps("camera")}
          messages={m}
          primaryActionClassName={props.classNames?.primaryAction}
          onClose={() => setCamera(false)}
          onCapture={(file) => void add([file], replacement)}
        />)
      ) : report ? (
        slot("review", <ExportReview
          {...partProps("review")}
          report={report}
          ready={result?.status === "ready" && result.file.size <= maxBytes}
          messages={m}
          primaryActionClassName={props.classNames?.primaryAction}
          onBack={() => session?.cancel()}
          onConfirm={confirm}
        />)
      ) : !pages.length ? (
        slot("empty", <div
          {...partProps("empty", "sf-empty")}
          onDragOver={(e) => {
            props.slotProps?.empty?.onDragOver?.(e);
            if (!e.defaultPrevented) e.preventDefault();
          }}
          onDrop={(e) => {
            props.slotProps?.empty?.onDrop?.(e);
            if (e.defaultPrevented) return;
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
              className={classFor("primaryAction", "sf-primary")}
              disabled={!session || busy}
              onClick={() => input.current?.click()}
            >
              {m.choosePhotos} <span aria-hidden="true">↑</span>
            </button>
            <button
              type="button"
              disabled={!session || busy}
              onClick={() => openCamera()}
            >
              {m.camera}
            </button>
          </div>
          <small>{m.formats}</small>
        </div>)
      ) : (
        <>
          {slot("toolbar", <div {...partProps("toolbar", "sf-toolbar")}>
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
                onClick={() => openCamera()}
              >
                {m.camera}
              </button>
            </div>
          </div>)}
          {slot("workspace", <div {...partProps("workspace", "sf-workspace")}>
            {slot("pageList", <aside {...partProps("pageList", "sf-pages")} aria-label={m.pages}>
              {pages.map((p, i) => (
                <div key={p.id}>
                  <Thumbnail
                    page={p}
                    index={i}
                    selected={p.id === page?.id}
                    onSelect={() => selectPage(p.id)}
                    m={m}
                    className={props.classNames?.thumbnail}
                  />
                  {props.renderPageSummary?.(p, i)}
                </div>
              ))}
            </aside>)}
            {slot("editor", <div {...partProps("editor", "sf-editor")}>
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
                    <ProcessedPreview
                      session={session}
                      page={page}
                      messages={m}
                    />
                  )}
                  {slot("pageActions", <div {...partProps("pageActions", "sf-page-actions")}>
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
                          removePage(page.id);
                      }}
                    >
                      {m.remove}
                    </button>
                  </div>)}
                  {page.warnings.map((w) => (
                    <p key={w} className="sf-hint">
                      {m[warningKey[w]]}
                    </p>
                  ))}
                </>
              ) : null}
            </div>)}
          </div>)}
          {slot("footer", <footer {...partProps("footer", "sf-footer")}>
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
                className={classFor("primaryAction", "sf-primary")}
                disabled={busy || !validLimit}
                onClick={() => void prepare()}
              >
                {m.prepare} <span aria-hidden="true">→</span>
              </button>
            </div>
          </footer>)}
        </>
      )}
      {slot("privacy", <div {...partProps("privacy", "sf-privacy")}>
        <span aria-hidden="true">◈</span> {m.privacy}
        <small>{m.noRecovery}</small>
      </div>)}
    </section>
  );
}
