// Local-only harness: serves the production build (dist/) with the SAME headers
// vercel.json applies in production, so the enforced CSP can be smoke-tested
// against the real bundle before deploying. Not shipped; not referenced by the app.
import http from "node:http";
import { readFile } from "node:fs/promises";
import { existsSync, statSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve("dist");
const PORT = Number(process.env.PORT) || 4178;

const CSP =
  "default-src 'self'; script-src 'self' 'wasm-unsafe-eval' 'unsafe-eval'; " +
  "style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self' blob:; " +
  "worker-src 'self' blob:; connect-src 'self' https://storage.googleapis.com; font-src 'self'; object-src 'none'; " +
  "base-uri 'self'; form-action 'self'; frame-ancestors 'none'";

const TYPES = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".mjs": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".wasm": "application/wasm",
  ".task": "application/octet-stream",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
};

const server = http.createServer(async (req, res) => {
  try {
    const urlPath = decodeURIComponent((req.url || "/").split("?")[0]);
    let filePath = path.join(ROOT, urlPath);
    if (!existsSync(filePath) || statSync(filePath).isDirectory()) {
      filePath = path.join(ROOT, "index.html"); // SPA fallback
    }
    const ext = path.extname(filePath);
    const data = await readFile(filePath);
    res.setHeader("Content-Type", TYPES[ext] || "application/octet-stream");
    res.setHeader("Content-Security-Policy", CSP);
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.writeHead(200);
    res.end(data);
  } catch {
    res.writeHead(500);
    res.end("error");
  }
});

server.listen(PORT, () => console.log(`serving dist with prod headers on http://localhost:${PORT}`));
