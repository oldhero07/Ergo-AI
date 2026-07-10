import { useCallback, useState } from "react";
import { exportPdfReport } from "@/lib/pdf";
import { downloadText, exportJson, photoCsv } from "@/lib/exportData";
import type { ReportMetaValues } from "@/components/ReportDetails";
import type { UploadItem } from "@/types";
import type { ResultMap } from "@/state/usePhotoSession";

interface ExportDeps {
  items: UploadItem[];
  results: ResultMap;
  excludedIds: Set<string>;
  methodId: string;
  reportMeta: ReportMetaValues;
}

/** PDF/CSV/JSON exports of the scored photo batch (excluded photos dropped). */
export function useExports({ items, results, excludedIds, methodId, reportMeta }: ExportDeps) {
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const exportCsv = useCallback(() => {
    const rows = items
      .filter((it) => results[it.id] && !excludedIds.has(it.id))
      .map((it) => ({ fileName: it.file.name, analysis: results[it.id] }));
    if (!rows.length) return;
    downloadText(`ergo-ai-${methodId}-data.csv`, "text/csv", photoCsv(rows, methodId));
  }, [items, results, methodId, excludedIds]);

  const exportJsonFile = useCallback(() => {
    const included = items.filter((it) => results[it.id] && !excludedIds.has(it.id));
    const payload = {
      app: "ergo-ai",
      generatedAt: new Date().toISOString(),
      method: methodId,
      // Exact pose-model build for provenance: any future score comparison is
      // attributable to a specific model, not a mystery.
      modelVersion: included.map((it) => results[it.id].modelVersion).find(Boolean) ?? null,
      meta: { assessor: reportMeta.assessor, organization: reportMeta.organization, subject: reportMeta.subject },
      items: included.map((it) => {
        const r = results[it.id];
        return {
          fileName: it.file.name,
          detected: r.detected,
          error: r.error,
          angles: r.angles,
          wristMeasured: r.wristMeasured,
          measuredFlags: r.measuredFlags,
          offProfile: r.offProfile,
          input: r.input,
          assessment: r.assessment,
        };
      }),
    };
    if (!payload.items.length) return;
    downloadText(`ergo-ai-${methodId}-data.json`, "application/json", exportJson(payload));
  }, [items, results, methodId, reportMeta, excludedIds]);

  const exportPdf = useCallback(async () => {
    setExporting(true);
    setExportError(null);
    try {
      const reportItems = items
        .filter((it) => results[it.id] && !excludedIds.has(it.id))
        .map((it) => ({ fileName: it.file.name, originalUrl: it.url, analysis: results[it.id] }));
      await exportPdfReport(reportItems, reportMeta);
    } catch (e) {
      setExportError((e as Error).message || "Could not generate the PDF.");
    } finally {
      setExporting(false);
    }
  }, [items, results, reportMeta, excludedIds]);

  const clearExportState = useCallback(() => {
    setExportError(null);
    setExporting(false);
  }, []);

  return { exporting, exportError, exportPdf, exportCsv, exportJsonFile, clearExportState };
}

export type Exports = ReturnType<typeof useExports>;
