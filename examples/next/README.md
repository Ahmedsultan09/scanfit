# Next.js App Router example

The route remains server-rendered while `scanner-client.tsx` dynamically loads browser-only scanning. Import the global ScanFit stylesheet from the root layout.

From the repository root:

```sh
npm run build
npm run dev --workspace @scanfit/example-next
```

Camera access requires HTTPS outside localhost. No API route or upload endpoint is needed.
