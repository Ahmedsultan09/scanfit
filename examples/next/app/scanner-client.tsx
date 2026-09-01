"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";

const DocumentScanner = dynamic(
  () => import("@scanfit/browser/react").then((module) => module.DocumentScanner),
  { ssr: false, loading: () => <p role="status">Loading scanner…</p> },
);

export function ScannerClient() {
  const [download, setDownload] = useState<{ url: string; bytes: number }>();

  useEffect(() => {
    if (!download) return;
    return () => URL.revokeObjectURL(download.url);
  }, [download]);

  return (
    <>
      <DocumentScanner
        maxBytes={2_000_000}
        onComplete={({ file }) => {
          setDownload({ url: URL.createObjectURL(file), bytes: file.size });
        }}
      />
      {download ? (
        <p className="result" role="status">
          Confirmed {download.bytes.toLocaleString()}-byte PDF.{" "}
          <a href={download.url} download="scanfit-document.pdf">Download it</a>
        </p>
      ) : null}
    </>
  );
}
