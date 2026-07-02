import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";

export default defineConfig({
  // Relative base so the same build works at any path: Vercel root, the
  // github.io/Ergo-AI/ subpath, and the rulaergo.com custom-domain root. All
  // asset URLs (incl. runtime import.meta.env.BASE_URL fetches for the model,
  // wasm, and samples) resolve relative to the served page. The app has no
  // client-side routing, so relative resolution is always correct.
  base: "./",
  plugins: [react()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          // One shared lazy chunk for the whole 3D stack so the hero scene and
          // the pose viewer don't each bundle their own copy of three.js.
          if (/node_modules[\\/](three|@react-three)[\\/]/.test(id)) {
            return "three-vendor";
          }
        },
      },
    },
  },
});
