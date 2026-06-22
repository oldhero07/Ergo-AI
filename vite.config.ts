import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";

export default defineConfig({
  // Vercel/custom-domain serve at root ("/"); GitHub Pages serves under the repo
  // subpath. The Pages workflow sets PAGES_BASE="/Ergo-AI/". All runtime asset
  // paths use import.meta.env.BASE_URL, so this is the only base switch needed.
  base: process.env.PAGES_BASE || "/",
  plugins: [react()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
