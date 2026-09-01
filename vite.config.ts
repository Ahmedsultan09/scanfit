import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { classicalOnly } from "./build/classical-only";

export default defineConfig({
  plugins: [classicalOnly(), react()],
  optimizeDeps: { exclude: ["scanic"], include: ["tinypdf"] },
  worker: { format: "es", plugins: () => [classicalOnly()] },
  build: { outDir: "dist/playground" },
  server: { port: 5173, strictPort: true },
});
