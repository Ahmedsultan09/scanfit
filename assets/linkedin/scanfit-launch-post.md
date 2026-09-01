I’ve just published ScanFit, a free and open-source scan-to-PDF library for the browser.

The problem sounds simple:

A user has several document photos. The form accepts one PDF, and it must stay under a strict upload limit.

For frontend teams, that usually means connecting camera input, image correction, page controls, compression, PDF generation and final-size validation. A preview can still look fine while the file that gets submitted is too large—or too compressed to trust.

ScanFit handles that workflow in one browser library:

Photos → crop and correct → reorder → fit the byte limit → inspect the exported pixels → receive a PDF `File`.

What makes it useful:

- The host sets an exact `maxBytes` value.
- A successful export never exceeds that limit, including PDF overhead.
- If the document cannot fit without crossing the configured quality floors, ScanFit returns `cannot-fit` with page-level diagnostics.
- The final preview shows the compressed pixels embedded in the PDF, not a higher-quality substitute.
- Processing stays on the device. ScanFit does not upload or store the document.
- The full distributed runtime is about 43 kB gzip, with no Scanic dependency, ML model or detector WASM.

It is intended for frontend developers and product teams building application forms, education platforms and document-upload portals—especially when documents begin as phone photos and the portal enforces a file-size limit.

Install the public alpha:

`npm install @scanfit/browser@next`

Then use the React scanner:

```tsx
import { DocumentScanner } from "@scanfit/browser/react";
import "@scanfit/browser/styles.css";

<DocumentScanner
  maxBytes={2_000_000}
  onComplete={({ file }) => attachToForm(file)}
/>
```

There is also a framework-independent TypeScript core, plus examples for Next.js, Vue, Svelte and vanilla TypeScript.

ScanFit is still an alpha. Physical-device testing, a broader real-document corpus and early integration feedback are the next priorities.

Live demo: https://scanfit-two.vercel.app
GitHub: https://github.com/Ahmedsultan09/scanfit
npm: https://www.npmjs.com/package/@scanfit/browser

If you build document-upload flows, I’d value your feedback on the API and the cases that usually break your users’ uploads.

#OpenSource #TypeScript #React #Frontend #WebDevelopment
