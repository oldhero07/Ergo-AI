/// <reference lib="webworker" />
/**
 * Image-preparation worker: decodes each queued photo (HEIC via the heic-to
 * wasm decoder - the expensive step that used to freeze the UI thread) and
 * returns small JPEG blobs for the grid preview and, for HEIC, for analysis.
 * Requests are serialized within a worker so a big drop never holds more than
 * one decoded photo in this worker's memory at a time.
 */
import { prepareImageBlobs } from "@/lib/prepareCore";
import type { PrepareRequest, PrepareResponse } from "@/workers/prepareProtocol";

declare const self: DedicatedWorkerGlobalScope;

const post = (msg: PrepareResponse) => self.postMessage(msg);

let queue: Promise<void> = Promise.resolve();

self.onmessage = (event: MessageEvent<PrepareRequest>) => {
  const { id, file } = event.data;
  queue = queue.then(async () => {
    try {
      const blobs = await prepareImageBlobs(file);
      post({ type: "prepared", id, ...blobs });
    } catch (err) {
      post({ type: "error", id, message: (err as Error)?.message || "Could not decode this image." });
    }
  });
};
