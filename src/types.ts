/** Which analysis flow the user chose from the landing. */
export type AnalysisMode = "photo" | "video";

export interface UploadItem {
  id: string;
  file: File;
  /** Small preview-thumbnail object URL ("" while it's still being prepared). */
  url: string;
  /** True while the preview thumbnail is being prepared. */
  converting?: boolean;
}
