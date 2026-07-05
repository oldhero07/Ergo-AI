/**
 * Base URL that wasm/model assets resolve against. On the main thread this is
 * Vite's relative BASE_URL (resolved by the browser against the page). Inside
 * the analysis worker, relative URLs would wrongly resolve against the hashed
 * worker script under /assets/, so the main thread computes an absolute base
 * (new URL(BASE_URL, document.baseURI)) and passes it in the worker's init
 * message, which calls `configureAssetBase` before any model loads.
 */
let assetBase: string = import.meta.env.BASE_URL;

export function configureAssetBase(base: string): void {
  assetBase = base.endsWith("/") ? base : `${base}/`;
}

export function getAssetBase(): string {
  return assetBase;
}

/** Absolute asset base for handing to a worker, resolved against the page. */
export function absoluteAssetBase(): string {
  return new URL(import.meta.env.BASE_URL, document.baseURI).href;
}

/**
 * Deterministic mode: force the CPU delegate for both landmarkers. GPU inference
 * is not bit-identical across GPUs/drivers/browsers (Metal on Mac Safari vs
 * ANGLE/D3D on Windows Chrome), which shifts landmark coordinates and can flip a
 * RULA band at a boundary. CPU inference reproduces far better across machines,
 * at a speed cost - so it's opt-in via localStorage "ergo-deterministic" = "1".
 *
 * The worker has no `localStorage`, so the UI thread reads the pref and passes it
 * in the init message; the inline path sets it directly. Defaults to false (GPU).
 */
let deterministic = false;

export function configureDeterministic(value: boolean): void {
  deterministic = value;
}

export function isDeterministic(): boolean {
  return deterministic;
}

/** Read the deterministic-mode preference from localStorage (UI thread only). */
export function readDeterministicPref(): boolean {
  try {
    return localStorage.getItem("ergo-deterministic") === "1";
  } catch {
    return false; // private mode / no storage - default to GPU
  }
}
