/** Which analysis flow the user chose from the landing. */
export type AnalysisMode = "photo" | "video";

export interface UploadItem {
  id: string;
  file: File;
  url: string;
  /** HEIC only: true while we decode it to a viewable JPEG in the background. */
  converting?: boolean;
}
