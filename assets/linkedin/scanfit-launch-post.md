I’ve just published ScanFit, a free and open-source scan-to-PDF library for the browser.

A document-upload field often assumes the PDF already exists.

But when the document is still on paper, the user has to leave the website, open a separate scanner app, capture each page, export a PDF, return to the form and upload it.

If the portal rejects that PDF for exceeding its upload limit, the user has to leave the flow again and find another way to compress it.

That interrupted journey is the problem ScanFit is designed to remove.

ScanFit lets developers put the complete workflow inside their website:

Capture or import → correct pages → reorder → fit the byte limit → inspect the exported result → receive a PDF `File`.

The user stays in the form, while the host application receives the finished file and controls its submission.

What makes it useful:

- The host sets an exact `maxBytes` value.
- A successful export never exceeds that limit, including PDF overhead.
- If the document cannot fit without crossing the configured quality floors, ScanFit returns `cannot-fit` with page-level diagnostics.
- The final preview shows the compressed pixels embedded in the PDF, not a higher-quality substitute.
- Processing stays on the device. ScanFit does not upload or store the document.
- The full distributed runtime is about 43 kB gzip and uses browser-native processing.

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

If you build document-upload flows, try it and share the cases that usually break your users’ uploads.

#OpenSource #TypeScript #React #Frontend #WebDevelopment
