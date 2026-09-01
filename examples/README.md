# Framework examples

These applications consume the same local `@scanfit/browser` workspace that will become the npm package. They make no document uploads and do not require a backend.

| Example | Interface demonstrated |
| --- | --- |
| [Vite + React](vite-react) | Lazy `ScannerTrigger` and complete dialog |
| [Next.js App Router](next) | Client boundary around `DocumentScanner` |
| [Vanilla TypeScript](vanilla) | Framework-independent session core |
| [Vue](vue) | Session core connected to Vue state |
| [Svelte](svelte) | Session core connected to Svelte state |

From the repository root:

```sh
npm ci
npm run build
npm run test:examples
npm run dev --workspace @scanfit/example-vite-react
```

Replace the workspace name in the last command to run another example. The library must be built before a development server starts because its package exports point to `packages/scanfit/dist`.

The React examples provide the complete capture, crop, reorder, compression and confirmation interface. The vanilla, Vue and Svelte examples intentionally demonstrate the headless API: they import files and export an exact-size PDF, while a production integration can build its own editor around the same session operations.
