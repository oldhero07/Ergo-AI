/** Message contract between the main thread and the image-preparation worker. */
import type { PreparedBlobs } from "@/lib/prepareCore";

export interface PrepareRequest {
  id: string;
  file: File;
}

export type PrepareResponse =
  | ({ type: "prepared"; id: string } & PreparedBlobs)
  | { type: "error"; id: string; message: string };
