import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";

export default defineConfig({
  // Relative base so the same build works at any path: Vercel root, the
  // github.io/Ergo-AI/ subpath, and the rulaergo.com custom-domain root. All
  // asset URLs (incl. runtime import.meta.env.BASE_URL fetches for samples)
  // resolve relative to the served page. The app has no client-side routing,
  // so relative resolution is always correct.
  base: "./",
  plugins: [react()],
  server: {
    port: Number(process.env.PORT) || 5173,
    strictPort: !!process.env.PORT,
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
