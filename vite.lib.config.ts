import { defineConfig } from "vite";
import { resolve } from "node:path";

export default defineConfig({
  base: "./",
  publicDir: false,
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
  worker: { format: "es" },
});
