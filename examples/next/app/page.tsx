import { ScannerClient } from "./scanner-client";

export default function Page() {
  return (
    <main className="example-shell">
      <header>
        <p className="eyebrow">Next.js App Router</p>
        <h1>A scanner behind a client boundary</h1>
        <p>The page remains a Server Component; browser processing begins inside ScannerClient.</p>
      </header>
      <ScannerClient />
    </main>
  );
}
