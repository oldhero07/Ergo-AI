/**
 * Capture pose-API responses for the bundled sample photos into
 * src/test/fixtures/keypoints/ so vitest never needs a live server.
 * Requires the inference server running locally:
 *   cd server && uvicorn app:app --port 7860
 * Usage: node scripts/capture-fixtures.mjs [baseUrl]
 */
import { readdir, readFile, mkdir, writeFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const samplesDir = join(root, "public", "samples");
const outDir = join(root, "src", "test", "fixtures", "keypoints");
const base = process.argv[2] ?? "http://localhost:7860";

const health = await fetch(`${base}/healthz`).then((r) => r.json());
console.log(`server ok: ${health.model_version}`);

await mkdir(outDir, { recursive: true });
for (const name of (await readdir(samplesDir)).filter((n) => n.endsWith(".jpg"))) {
  const bytes = await readFile(join(samplesDir, name));
  const form = new FormData();
  form.append("image", new Blob([bytes], { type: "image/jpeg" }), name);
  const res = await fetch(`${base}/analyze`, { method: "POST", body: form });
  if (!res.ok) throw new Error(`${name}: HTTP ${res.status}`);
  const json = await res.json();
  const out = join(outDir, name.replace(/\.jpg$/, ".json"));
  await writeFile(out, JSON.stringify(json, null, 1));
  console.log(`${name}: detected=${json.detected} -> ${out}`);
}
