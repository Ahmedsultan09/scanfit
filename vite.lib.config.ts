import { defineConfig } from "vite";
import { resolve } from "node:path";
import { classicalOnly } from "./build/classical-only";

export default defineConfig({
  plugins: [classicalOnly()],
  base: "./",
  build: {
    outDir: "packages/scanfit/dist",
    lib: {
      entry: Object.fromEntries(
        ["core", "react", "trigger", "detector", "pdf"].map((name) => [
          name,
          resolve(`packages/scanfit/src/${name}/index.ts`),
        ]),
      ),
      formats: ["es"],
      fileName: (_format, name) => `${name}.js`,
      cssFileName: "styles",
    },
    rollupOptions: {
      external: ["react", "react-dom", "react/jsx-runtime"],
      output: { chunkFileNames: "chunks/[name]-[hash].js" },
    },
    minify: true,
  },
  worker: { format: "es", plugins: () => [classicalOnly()] },
});
