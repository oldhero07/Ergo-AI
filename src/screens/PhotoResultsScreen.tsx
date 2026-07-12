import { useRef } from "react";
import { FileDown, Loader2, RotateCcw, AlertTriangle, Eye, Weight } from "lucide-react";
import { useScrollReveal } from "@/hooks/useScrollMotion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Scorecard } from "@/components/Scorecard";
import { MeasurementSummary } from "@/components/MeasurementSummary";
import { AdjustmentsPanel } from "@/components/AdjustmentsPanel";
import { RecommendationsPanel } from "@/components/RecommendationsPanel";
import { ReportDetails } from "@/components/ReportDetails";
import { methods } from "@/assessment/registry";
import { useAppState } from "@/state/AppStateContext";
import { RISK_PILL } from "@/lib/risk";
import { cn } from "@/lib/utils";
import type { PoseAnalysis } from "@/lib/analysis";
import type { UploadItem } from "@/types";

export type { ResultMap } from "@/state/usePhotoSession";
import type { ResultMap } from "@/state/usePhotoSession";

/** A photo needs assessor review when the model flagged estimated angles or an
 * off-profile camera - the score is a best read, not a confident measurement. */
function needsReview(r: PoseAnalysis | undefined): boolean {
  if (!r?.assessment) return false;
  if (r.offProfile) return true;
  return !!r.measuredFlags && Object.values(r.measuredFlags).some((v) => v === false);
}

/**
 * The scored-photos results view, decision-first: batch verdict and review
 * status up top, exports next, per-photo evidence below (worst first). Reads
 * the session from AppStateContext; child components stay prop-driven.
 */
export function PhotoResultsScreen() {
  const { photo, exports, methodId, reportMeta, setReportMeta, navigate, reset } = useAppState();
  const { items, results, excludedIds, includedItems, worstIncludedId } = photo;
  const { exporting, exportError } = exports;
  const rootRef = useRef<HTMLDivElement>(null);
  useScrollReveal(rootRef);

  const reviewCount = includedItems.filter((it) => needsReview(results[it.id])).length;

  return (
    <div ref={rootRef} className="mx-auto w-full max-w-4xl animate-in fade-in duration-500">
      {/* Header: what was assessed + which method scores it */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Results</h2>
          <p className="text-sm text-muted-foreground">
            {includedItems.length} photo{includedItems.length !== 1 ? "s" : ""} in report
            {excludedIds.size > 0 ? ` · ${excludedIds.size} excluded` : ""}
          </p>
        </div>
        <Tabs value={methodId} onValueChange={photo.switchMethod}>
          <TabsList aria-label="Assessment method">
            {methods.map((m) => (
              <TabsTrigger key={m.id} value={m.id}>
                {m.name}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      {/* Batch verdict */}
      <BatchSummary items={includedItems} results={results} reviewCount={reviewCount} />

      {/* Review-loop nudge: close the loop BEFORE exporting */}
      {reviewCount > 0 && (
        <Alert variant="warning" className="mb-4">
          <Eye />
          <AlertDescription>
            {reviewCount === 1 ? "1 photo has" : `${reviewCount} photos have`} estimated angles or an
            off-profile camera view. Review the flagged measurements below before exporting the report.
          </AlertDescription>
        </Alert>
      )}

      {/* Export toolbar */}
      <Card className="mb-4 flex flex-wrap items-center justify-between gap-3 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={() => void exports.exportPdf()} disabled={exporting}>
            {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
            Export PDF report
          </Button>
          <Button variant="outline" size="sm" onClick={exports.exportCsv}>
            CSV
          </Button>
          <Button variant="outline" size="sm" onClick={exports.exportJsonFile}>
            JSON
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => navigate("niosh")}>
            <Weight className="h-4 w-4" /> NIOSH lifting
          </Button>
          <Button variant="outline" size="sm" onClick={reset}>
            <RotateCcw className="h-4 w-4" /> Start over
          </Button>
        </div>
      </Card>
      {exportError && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>Could not generate the PDF: {exportError}</AlertDescription>
        </Alert>
      )}

      <ReportDetails meta={reportMeta} onChange={setReportMeta} />

      {/* Per-photo evidence, worst first */}
      <div className="mt-6 space-y-8">
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
            const review = needsReview(r) && !excluded;
            return (
              <Card
                key={it.id}
                data-reveal
                className={cn(
                  "overflow-hidden p-0",
                  excluded && "opacity-60",
                  isWorst && r?.assessment && "ring-2 ring-destructive/60",
                )}
              >
                {isWorst && r?.assessment && (
                  <div className="flex items-center gap-1.5 bg-destructive/10 px-4 py-1.5 text-xs font-semibold text-destructive">
                    <AlertTriangle className="h-4 w-4" /> Worst posture in batch · investigate first
                  </div>
                )}
                {r?.assessment && (
                  <div className="flex flex-wrap items-center gap-2 border-b bg-muted/40 px-4 py-2 text-xs">
                    <span className="max-w-[40%] truncate font-medium text-foreground" title={it.file.name}>
                      {it.file.name}
                    </span>
                    <span className={cn("tabular-readout rounded-md px-1.5 py-0.5 font-bold", RISK_PILL[r.assessment.riskBand])}>
                      {r.assessment.grandScore}
                    </span>
                    {review && (
                      <Badge variant="muted" className="gap-1 text-risk-medium">
                        <Eye className="h-3 w-3" /> Review estimates
                      </Badge>
                    )}
                    {excluded && <span className="font-semibold text-risk-medium">Excluded from report</span>}
                    <button
                      type="button"
                      onClick={() => photo.toggleExclude(it.id)}
                      className="ml-auto rounded-md border bg-card px-2 py-1 font-medium text-muted-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
                        onChange={(next) => photo.updateInput(it.id, next)}
                        measuredFlags={r.measuredFlags}
                      />
                    )}
                    {r.input && <RecommendationsPanel result={r.assessment} input={r.input} />}
                  </>
                ) : (
                  <div className="flex items-center gap-2 border-t px-5 py-4 text-sm text-risk-medium">
                    <AlertTriangle className="h-4 w-4" /> No scorable full-body pose - the head and torso must be in
                    frame. Use a clearer, full-body side view.
                  </div>
                )}
              </Card>
            );
          })}
      </div>
    </div>
  );
}

/** Batch verdict strip: scored count, mean, worst, and review status. */
function BatchSummary({
  items,
  results,
  reviewCount,
}: {
  items: UploadItem[];
  results: ResultMap;
  reviewCount: number;
}) {
  const scored = items
    .map((it) => ({ it, r: results[it.id] }))
    .filter((x): x is { it: UploadItem; r: PoseAnalysis & { assessment: NonNullable<PoseAnalysis["assessment"]> } } =>
      Boolean(x.r?.assessment),
    );
  if (scored.length < 2) return null;

  const scores = scored.map(({ r }) => r.assessment.grandScore);
  const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
  const max = Math.max(...scores);
  const worst = scored.find(({ r }) => r.assessment.grandScore === max);

  return (
    <Card data-reveal-stagger className="mb-4 grid grid-cols-2 gap-3 p-4 text-center sm:grid-cols-4">
      <div>
        <div className="tabular-readout text-2xl font-semibold">
          {scored.length}/{items.length}
        </div>
        <div className="text-xs text-muted-foreground">photos scored</div>
      </div>
      <div>
        <div className="tabular-readout text-2xl font-semibold">{mean.toFixed(1)}</div>
        <div className="text-xs text-muted-foreground">mean grand score</div>
      </div>
      <div>
        <div className={cn("tabular-readout inline-block rounded-md px-2 text-2xl font-semibold", worst && RISK_PILL[worst.r.assessment.riskBand])}>
          {max}
        </div>
        <div className="truncate text-xs text-muted-foreground" title={worst?.it.file.name}>
          worst{worst ? ` · ${worst.it.file.name}` : ""}
        </div>
      </div>
      <div>
        <div className={cn("tabular-readout text-2xl font-semibold", reviewCount > 0 ? "text-risk-medium" : "text-risk-low")}>
          {reviewCount}
        </div>
        <div className="text-xs text-muted-foreground">need{reviewCount === 1 ? "s" : ""} review</div>
      </div>
    </Card>
  );
}
