import { useEffect, useState } from "react";
import { ScannerTrigger } from "@scanfit/browser/trigger";

export function App() {
  const [download, setDownload] = useState<{
    url: string;
    name: string;
    bytes: number;
  }>();

  useEffect(() => {
    if (!download) return;
    return () => URL.revokeObjectURL(download.url);
  }, [download]);

  return (
    <main className="example-shell">
      <header>
        <p className="eyebrow">Vite + React</p>
        <h1>Prepare an upload-ready PDF</h1>
        <p>The scanner runs locally and returns a confirmed file below 2,000,000 bytes.</p>
      </header>

      <ScannerTrigger
        maxBytes={2_000_000}
        onComplete={({ file }) => {
          setDownload({
            url: URL.createObjectURL(file),
            name: file.name,
            bytes: file.size,
          });
        }}
      >
        Scan documents
      </ScannerTrigger>

      {download ? (
        <p role="status" className="result">
          Confirmed {download.bytes.toLocaleString()}-byte PDF.{" "}
          <a href={download.url} download={download.name}>Download it</a>
        </p>
      ) : null}
    </main>
  );
}
