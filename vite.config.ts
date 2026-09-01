import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  optimizeDeps: { include: ["tinypdf"] },
  worker: { format: "es" },
  build: { outDir: "dist/playground" },
  server: { port: 5173, strictPort: true },
});
