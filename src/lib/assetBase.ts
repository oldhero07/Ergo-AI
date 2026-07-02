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
