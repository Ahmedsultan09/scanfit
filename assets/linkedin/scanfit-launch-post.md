I’ve published ScanFit, a free and open-source scan-to-PDF library for the browser.

Picture a user halfway through an application form. The portal asks for one PDF under 2 MB, but the document is still on paper.

They leave the website, open CamScanner or another scanning app, capture the pages, export a PDF, return and upload it. Switching away may cost them unsaved answers or an expired session. If the PDF exceeds the limit, they leave again to find a compression tool.

ScanFit is designed to keep that entire journey inside the website:

Capture or import → detect and correct pages → reorder → fit the byte limit → inspect the exported result → receive a PDF `File`.

The host application controls submission. ScanFit handles the document workflow without uploading or storing the user’s pages.

What happens before ScanFit returns a file:

- The developer provides an exact integer `maxBytes` limit.
- ScanFit measures the completed PDF, including structural overhead.
- A `ready` result never exceeds that limit.
- The report shows total bytes plus each page’s size, dimensions, encoding settings and warnings.
- The review screen displays the actual compressed pixels embedded in the PDF, so users can zoom in and check text, signatures and stamps.
- If the document cannot fit within the configured quality and resolution floors, ScanFit returns `cannot-fit` with page diagnostics. It does not silently remove pages, change the color mode or cross those floors.

The workflow also includes camera capture; JPEG, PNG and WebP import; automatic corner detection and manual cropping; rotation, retaking, removal and drag-free reordering; color, grayscale and contrast filters; blur and darkness warnings; and A4, Letter or image-proportional pages.

Where this can help:

- Government portals collecting IDs, applications and supporting documents.
- Schools and universities handling enrollment forms, assignments and consent papers.
- HR and recruitment systems collecting certificates and onboarding paperwork.
- Insurance and claims portals receiving forms, receipts and photo evidence.
- Any product that accepts paper documents through a size-limited upload field.

Install the public alpha:

`npm install @scanfit/browser@next`

```tsx
import { DocumentScanner } from "@scanfit/browser/react";
import "@scanfit/browser/styles.css";

<DocumentScanner
  maxBytes={2_000_000}
  onComplete={({ file }) => attachToForm(file)}
/>
```

It includes React components, a framework-independent TypeScript core and examples for Next.js, Vue, Svelte and vanilla TypeScript.

ScanFit is an alpha. Physical-device testing and broader real-document trials are next.

Live demo: https://scanfit-two.vercel.app
GitHub: https://github.com/Ahmedsultan09/scanfit
npm: https://www.npmjs.com/package/@scanfit/browser

If you build document-upload flows, I’d value the edge cases that currently send your users out of the form.

#OpenSource #TypeScript #React #Frontend #WebDevelopment
