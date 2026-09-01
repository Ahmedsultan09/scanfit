import { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  DocumentScanner,
  useScanSession,
  formatBytes,
} from "../packages/scanfit/src/react";
import { ScannerTrigger } from "../packages/scanfit/src/trigger";
import type { ExportReport } from "../packages/scanfit/src/core";
import { createSample } from "./samples";
import "./playground.css";

function App() {
  const { session, status } = useScanSession(),
    [maxBytes, setMaxBytes] = useState(2_000_000),
    [rtl, setRtl] = useState(false),
    [error, setError] = useState("");
  const [completed, setCompleted] = useState<{
      file: File;
      report: ExportReport;
    } | null>(null),
    [sampleBusy, setSampleBusy] = useState(false);
  async function samples() {
    if (!session) return;
    setSampleBusy(true);
    setError("");
    try {
      for (let i = 0; i < 3; i++)
        await session.addFiles([await createSample(i)]);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSampleBusy(false);
    }
  }
  function download() {
    if (!completed) return;
    const url = URL.createObjectURL(completed.file),
      a = document.createElement("a");
    a.href = url;
    a.download = "scanfit-document.pdf";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <>
      <nav className="demo-nav">
        <a href="#" className="demo-brand">
          <span aria-hidden="true">▧</span> scanfit
          <span className="demo-alpha">ALPHA</span>
        </a>
        <div>
          <a href="#how-it-works">How it works</a>
          <a href="#developer-api">
            For developers <span aria-hidden="true">↗</span>
          </a>
        </div>
      </nav>
      <main>
        <header className="demo-hero">
          <div className="demo-eyebrow">
            <span /> SMALL LIBRARY. LESS PAPERWORK.
          </div>
          <h1>
            From paperwork
            <br />
            to <em>upload-ready.</em>
          </h1>
          <p>
            A private, lightweight document scanner for your website.
            <br />
            Turn photos into a PDF that fits. Keep the important details.
          </p>
          <div className="demo-badges">
            <span>◈ On-device processing</span>
            <span>↳ Exact file-size checks</span>
            <span>✳ Free & open source</span>
          </div>
        </header>
        <section className="demo-workbench" aria-label="Interactive playground">
          <div className="demo-workbench-heading">
            <div>
              <span className="demo-section-index">01 /</span>
              <h2>Try the scanner</h2>
            </div>
            <span className="demo-live">
              <i /> LOCAL PLAYGROUND
            </span>
          </div>
          <div className="demo-config">
            <label>
              Upload limit{" "}
              <select
                aria-label="Demo upload limit"
                value={maxBytes}
                onChange={(e) => setMaxBytes(Number(e.target.value))}
              >
                {[
                  100_000, 250_000, 500_000, 1_000_000, 2_000_000, 5_000_000,
                ].map((n) => (
                  <option key={n} value={n}>
                    {formatBytes(n)}
                  </option>
                ))}
              </select>
            </label>
            <label className="demo-rtl">
              <input
                type="checkbox"
                checked={rtl}
                onChange={(e) => setRtl(e.target.checked)}
              />{" "}
              RTL layout
            </label>
            <button
              type="button"
              disabled={!session || status !== "idle" || sampleBusy}
              onClick={() => void samples()}
            >
              {sampleBusy ? "Adding samples…" : "Try with sample documents"}{" "}
              <span aria-hidden="true">↗</span>
            </button>
          </div>
          {error ? (
            <p role="alert" className="demo-alert">
              {error}
            </p>
          ) : null}
          {session ? (
            <DocumentScanner
              session={session}
              maxBytes={maxBytes}
              dir={rtl ? "rtl" : "ltr"}
              onComplete={setCompleted}
            />
          ) : null}
          {completed ? (
            <div className="demo-complete" role="status">
              <div>
                <strong>Your PDF is ready.</strong>
                <span>
                  {completed.report.pages.length} pages ·{" "}
                  {formatBytes(completed.file.size)} · nothing uploaded
                </span>
              </div>
              <button type="button" onClick={download}>
                Download PDF ↓
              </button>
            </div>
          ) : null}
        </section>
        <section id="how-it-works" className="demo-how">
          <div className="demo-small-heading">A LITTLE LESS FRICTION</div>
          <div className="demo-three">
            <article>
              <span>01</span>
              <h3>Bring your pages.</h3>
              <p>
                Take a photo or choose images. Straighten the edges and keep
                every page in order.
              </p>
            </article>
            <article>
              <span>02</span>
              <h3>Make room for details.</h3>
              <p>
                Set your upload limit. See the real file size, and inspect what
                compression changes.
              </p>
            </article>
            <article>
              <span>03</span>
              <h3>Your file. Your choice.</h3>
              <p>
                Confirm the result, then download it or pass it to your
                application. No cloud detour.
              </p>
            </article>
          </div>
        </section>
        <section id="developer-api" className="demo-developer">
          <div>
            <div className="demo-small-heading">BUILT TO FIT YOUR STACK</div>
            <h2>
              The last mile
              <br />
              of document uploads.
            </h2>
            <p>
              React components, a headless TypeScript core, and a processing
              worker. Bring your own backend—or none at all.
            </p>
            <ScannerTrigger maxBytes={maxBytes} onComplete={setCompleted}>
              Try the lazy-loaded dialog ↗
            </ScannerTrigger>
          </div>
          <pre>
            <code>{`<DocumentScanner\n  maxBytes={2_000_000}\n  onComplete={({ file, report }) => {\n    // A real File, within your byte limit.\n    // Nothing is uploaded automatically.\n    attachToYourForm(file);\n  }}\n/>`}</code>
          </pre>
        </section>
        <aside className="demo-note">
          An early implementation, not a production certification. Real-phone
          performance, native camera behavior, and user trials remain release
          gates. PDFs contain images, not searchable text.
        </aside>
      </main>
      <footer className="demo-footer">
        <span className="demo-brand">▧ scanfit</span>
        <span>No accounts. No watermarks. No document uploads.</span>
        <span>MIT licensed · 2026</span>
      </footer>
    </>
  );
}
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
