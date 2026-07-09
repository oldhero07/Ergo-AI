import { FileDown, Loader2, RotateCcw, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Scorecard } from "@/components/Scorecard";
import { MeasurementSummary } from "@/components/MeasurementSummary";
import { AdjustmentsPanel } from "@/components/AdjustmentsPanel";
import { RecommendationsPanel } from "@/components/RecommendationsPanel";
import { ReportDetails, type ReportMetaValues } from "@/components/ReportDetails";
import { methods } from "@/assessment/registry";
import type { PoseAnalysis } from "@/lib/analysis";
import type { PostureInput } from "@/assessment/types";
import type { UploadItem } from "@/types";

export type ResultMap = Record<string, PoseAnalysis>;

/** The scored-photos results view: method tabs, exports, batch summary, and one
 * card per photo (images, scorecard, measurement summary, adjustments). Pure
 * render - all state lives in App's session state machine. */
export function PhotoResultsScreen({
  items,
  results,
  methodId,
  excludedIds,
  includedItems,
  worstIncludedId,
  reportMeta,
  onReportMetaChange,
  exporting,
  exportError,
  onSwitchMethod,
  onOpenNiosh,
  onExportPdf,
  onExportCsv,
  onExportJson,
  onReset,
  onToggleExclude,
  onUpdateInput,
}: {
  items: UploadItem[];
  results: ResultMap;
  methodId: string;
  excludedIds: Set<string>;
  includedItems: UploadItem[];
  worstIncludedId?: string;
  reportMeta: ReportMetaValues;
  onReportMetaChange: (next: ReportMetaValues) => void;
  exporting: boolean;
  exportError: string | null;
  onSwitchMethod: (id: string) => void;
  onOpenNiosh: () => void;
  onExportPdf: () => void;
  onExportCsv: () => void;
  onExportJson: () => void;
  onReset: () => void;
  onToggleExclude: (id: string) => void;
  onUpdateInput: (id: string, next: PostureInput) => void;
}) {
  return (
    <div className="mx-auto w-full max-w-4xl animate-in fade-in duration-500">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-4">
          <h2 className="text-xl font-semibold">Results</h2>
          <div role="tablist" aria-label="Assessment method" className="inline-flex rounded-lg border p-0.5">
            {methods.map((m) => (
              <button
                key={m.id}
                type="button"
                role="tab"
                aria-selected={methodId === m.id}
                onClick={() => onSwitchMethod(m.id)}
                className={
                  "rounded-md px-3 py-1 text-sm font-medium transition-colors " +
                  (methodId === m.id
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground")
                }
              >
                {m.name}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={onOpenNiosh}>
            NIOSH lifting
          </Button>
          <Button variant="outline" onClick={onExportPdf} disabled={exporting}>
            {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
            PDF
          </Button>
          <Button variant="outline" onClick={onExportCsv}>
            CSV
          </Button>
          <Button variant="outline" onClick={onExportJson}>
            JSON
          </Button>
          <Button variant="outline" onClick={onReset}>
            <RotateCcw className="h-4 w-4" /> Start over
          </Button>
        </div>
      </div>
      {exportError && <p className="mb-4 text-sm text-destructive">Could not generate the PDF: {exportError}</p>}
      <ReportDetails meta={reportMeta} onChange={onReportMetaChange} />
      {includedItems.length > 1 && <BatchSummary items={includedItems} results={results} />}
      <div className="space-y-8 mt-6">
        {[...items]
          .sort((a, b) => {
            const sa = results[a.id]?.assessment?.grandScore ?? -1;
            const sb = results[b.id]?.assessment?.grandScore ?? -1;
            return sb - sa;
          })
          .map((it) => {
            const r = results[it.id];
            const excluded = excludedIds.has(it.id);
            const isWorst = it.id === worstIncludedId && includedItems.length > 1;
            return (
              <div
                key={it.id}
                className={`overflow-hidden rounded-xl border ${excluded ? "opacity-60" : ""} ${isWorst && results[it.id]?.assessment ? "ring-2 ring-destructive/60" : ""}`}
              >
                {isWorst && results[it.id]?.assessment && (
                  <div className="flex items-center gap-1.5 bg-destructive/10 px-4 py-1.5 text-xs font-semibold text-destructive">
                    <AlertTriangle className="h-4 w-4" /> Worst posture in batch · investigate first
                  </div>
                )}
                {r?.assessment && (
                  <div className="flex items-center justify-end gap-2 border-b bg-muted/30 px-4 py-1.5 text-xs">
                    {excluded && <span className="mr-auto font-semibold text-amber-600">Excluded from report</span>}
                    <button
                      type="button"
                      onClick={() => onToggleExclude(it.id)}
                      className="rounded-md border px-2 py-1 font-medium text-muted-foreground hover:bg-muted"
                    >
                      {excluded ? "Include in report" : "Exclude from report"}
                    </button>
                  </div>
                )}
                <div className="grid sm:grid-cols-2">
                  <figure className="border-b sm:border-b-0 sm:border-r">
                    <img
                      src={r?.originalImageUrl ?? it.url}
                      alt="original"
                      className="aspect-[4/3] w-full bg-muted object-contain"
                    />
                    <figcaption className="truncate px-4 py-2 text-xs text-muted-foreground">
                      Original · {it.file.name}
                    </figcaption>
                  </figure>
                  <figure>
                    <img
                      src={r?.skeletonUrl ?? it.url}
                      alt="skeleton"
                      className="aspect-[4/3] w-full bg-muted object-contain"
                    />
                    <figcaption className="px-4 py-2 text-xs text-muted-foreground">AI pose skeleton</figcaption>
                  </figure>
                </div>
                {r?.error ? (
                  <div className="flex items-center gap-2 border-t px-5 py-4 text-sm text-destructive">
                    <AlertTriangle className="h-4 w-4" /> Could not analyze: {r.error}
                  </div>
                ) : r?.assessment ? (
                  <>
                    <div className="border-t">
                      <Scorecard result={r.assessment} />
                    </div>
                    {r.input && (
                      <div className="border-t">
                        <MeasurementSummary
                          method={r.assessment.method}
                          input={r.input}
                          confidence={r.angles?.confidence}
                          wristMeasured={r.wristMeasured}
                          sideBendMeasured={
                            r.angles?.neckSideBend !== undefined || r.angles?.trunkSideBend !== undefined
                          }
                          staticRepetition="assumed"
                          measuredFlags={r.measuredFlags}
                          offProfile={r.offProfile}
                        />
                      </div>
                    )}
                    {r.input && (
                      <AdjustmentsPanel
                        input={r.input}
                        methodId={methodId}
                        onChange={(next) => onUpdateInput(it.id, next)}
                        measuredFlags={r.measuredFlags}
                      />
                    )}
                    {r.input && <RecommendationsPanel result={r.assessment} input={r.input} />}
                  </>
                ) : (
                  <div className="flex items-center gap-2 border-t px-5 py-4 text-sm text-amber-600">
                    <AlertTriangle className="h-4 w-4" /> No scorable full-body pose - the head and torso must be in
                    frame. Use a clearer, full-body side view.
                  </div>
                )}
              </div>
            );
          })}
      </div>
    </div>
  );
}

/** Mean / max / worst-photo strip shown above the per-photo results when analyzing a batch. */
function BatchSummary({ items, results }: { items: UploadItem[]; results: ResultMap }) {
  const scored = items
    .map((it) => ({ it, r: results[it.id] }))
    .filter((x): x is { it: UploadItem; r: PoseAnalysis & { assessment: NonNullable<PoseAnalysis["assessment"]> } } =>
      Boolean(x.r?.assessment),
    );
  if (!scored.length) return null;

  const scores = scored.map(({ r }) => r.assessment.grandScore);
  const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
  const max = Math.max(...scores);
  const worst = scored.find(({ r }) => r.assessment.grandScore === max);

  return (
    <div className="mb-6 grid grid-cols-3 gap-3 rounded-lg border bg-muted/30 p-4 text-center">
      <div>
        <div className="text-2xl font-semibold tabular-nums">
          {scored.length}/{items.length}
        </div>
        <div className="text-xs text-muted-foreground">photos scored</div>
      </div>
      <div>
        <div className="text-2xl font-semibold tabular-nums">{mean.toFixed(1)}</div>
        <div className="text-xs text-muted-foreground">mean grand score</div>
      </div>
      <div>
        <div className="text-2xl font-semibold tabular-nums">{max}</div>
        <div className="truncate text-xs text-muted-foreground" title={worst?.it.file.name}>
          worst{worst ? ` · ${worst.it.file.name}` : ""}
        </div>
      </div>
    </div>
  );
}
