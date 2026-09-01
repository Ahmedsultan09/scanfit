I’ve published ScanFit, a free and open-source scan-to-PDF library for the browser.

Picture a user halfway through a form that requires a PDF under 2 MB, while the document is still on paper.

They leave the website, open CamScanner or another scanning app, capture and export, then return. Their answers may be gone or the session expired. If the PDF is too large, they leave again to compress it.

ScanFit keeps that workflow inside the website—and computer vision is a core part of how it works.

On capture or import, ScanFit’s built-in classical computer vision analyzes edges, regions and line geometry to find the document and estimate its four corners. It uses those corners to perspective-correct an angled photo into a flat page.

It also warns about possibly blurry, dark or low-resolution pages. Low-confidence detection falls back to manual cropping. Processing runs locally in a worker, without an ML model, external API or document upload.

The complete flow is:

Capture or import → detect and correct → crop, rotate and reorder → fit the byte limit → inspect → receive a PDF `File`.

Size validation is based on the finished PDF:

- The developer provides an exact `maxBytes` limit.
- ScanFit measures the completed PDF, including overhead; `ready` never exceeds the limit.
- The report shows total and per-page bytes, dimensions, encoding settings and warnings.
- Users inspect the actual compressed pixels embedded in the PDF.
- If quality and resolution floors prevent a fit, `cannot-fit` returns page diagnostics. ScanFit does not silently remove pages, change color mode or cross those floors.

It supports camera capture; JPEG, PNG and WebP; corner controls; retaking, removal and reordering; filters; and A4, Letter or image-proportional pages.

Potential use cases include government portals collecting applications, schools handling enrollment and assignments, HR systems receiving certificates, insurance claim portals, and any product with a size-limited document upload.

Install the public alpha:

`npm install @scanfit/browser@next`

`<DocumentScanner maxBytes={2_000_000} onComplete={({ file }) => attachToForm(file)} />`

It includes React components, a framework-independent TypeScript core and examples for Next.js, Vue, Svelte and vanilla TypeScript.

ScanFit is still in alpha, and I’m actively developing it. I need real-world testing and honest feedback on difficult detection, mobile performance, crop controls, output quality and integrations.

Try it with real documents and devices. Tell me where detection fails, what feels confusing and what is missing. Your feedback and insights will shape the next releases.

Live demo: https://scanfit-two.vercel.app
GitHub: https://github.com/Ahmedsultan09/scanfit
npm: https://www.npmjs.com/package/@scanfit/browser

#ComputerVision #OpenSource #TypeScript #React #Frontend
