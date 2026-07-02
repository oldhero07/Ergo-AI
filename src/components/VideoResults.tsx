import { useMemo, useRef, useState, useEffect } from "react";
import { AlertTriangle, FileDown, Loader2 } from "lucide-react";
import type { VideoAnalysis } from "@/lib/analyze";
import type { AssessmentResult, PostureInput, RiskBand } from "@/assessment/types";
import { getMethod, methods } from "@/assessment/registry";
import { Scorecard } from "@/components/Scorecard";
import { MeasurementSummary } from "@/components/MeasurementSummary";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { exportVideoPdfReport, type VideoPdfReport } from "@/lib/pdf";
import { downloadText, videoCsv } from "@/lib/exportData";
import { RecommendationsPanel } from "@/components/RecommendationsPanel";

/** Static (JIT-safelisted) risk-band -> Tailwind class lookups. */
const RISK_FILL_CLASSES: Record<RiskBand, string> = {
  low: "fill-risk-low",
  medium: "fill-risk-medium",
  high: "fill-risk-high drop-shadow-[0_0_5px_hsl(var(--risk-high)_/_65%)]",
  veryhigh: "fill-risk-veryhigh drop-shadow-[0_0_5px_hsl(var(--risk-veryhigh)_/_65%)]",
};

const RISK_TEXT_CLASSES: Record<RiskBand, string> = {
  low: "text-risk-low",
  medium: "text-risk-medium",
  high: "text-risk-high",
  veryhigh: "text-risk-veryhigh",
};

interface ScoredFrame {
  timeSec: number;
  thumbUrl: string;
  input: PostureInput;
  assessment: AssessmentResult;
}

const fmtTime = (s: number) => {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${String(sec).padStart(2, "0")}`;
};

/**
 * Re-grab ONE frame from the source clip at full sampling quality. Per-frame
 * thumbnails are kept small (320 px) so a 120-frame timeline stays light, but
 * the worst frame is the report's centerpiece - recapture it at up to 960 px
 * from the still-available video blob. Resolves null on any failure (the
 * caller falls back to the small thumb).
 */
function captureFrameHiRes(videoUrl: string, timeSec: number, maxEdge = 960): Promise<string | null> {
  return new Promise((resolve) => {
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";
    video.src = videoUrl;
    const timer = setTimeout(() => {
      cleanup();
      resolve(null);
    }, 10000);
    const cleanup = () => {
      clearTimeout(timer);
      video.removeAttribute("src");
      video.load();
    };
    video.addEventListener("error", () => {
      cleanup();
      resolve(null);
    });
    video.addEventListener("loadedmetadata", () => {
      video.currentTime = Math.min(timeSec, Math.max(0, (video.duration || timeSec) - 0.05));
    });
    video.addEventListener("seeked", () => {
      // One macrotask tick lets the seeked frame settle before reading pixels.
      setTimeout(() => {
        try {
          const scale = Math.min(1, maxEdge / Math.max(video.videoWidth, video.videoHeight));
          const w = Math.max(1, Math.round(video.videoWidth * scale));
          const h = Math.max(1, Math.round(video.videoHeight * scale));
          const canvas = document.createElement("canvas");
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext("2d");
          if (!ctx) throw new Error("no 2d context");
          ctx.drawImage(video, 0, 0, w, h);
          const url = canvas.toDataURL("image/jpeg", 0.85);
          cleanup();
          resolve(url);
        } catch {
          cleanup();
          resolve(null);
        }
      }, 0);
    });
  });
}

/** Risk-over-time view for an analyzed video: player + clickable timeline of
 * grand scores, peak/mean/time-in-high-risk stats, and the worst frame's score.
 * Scores are recomputed from each frame's PostureInput for the active method. */
export function VideoResults({
  videoUrl,
  fileName,
  analysis,
  methodId,
  onMethodChange,
  reportMeta,
}: {
  videoUrl: string;
  fileName: string;
  analysis: VideoAnalysis;
  methodId: string;
  onMethodChange: (id: string) => void;
  reportMeta: { assessor: string; organization: string; subject: string };
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playhead, setPlayhead] = useState(0);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [worstHiRes, setWorstHiRes] = useState<string | null>(null);

  const scored: ScoredFrame[] = useMemo(() => {
    const compute = getMethod(methodId).compute;
    return analysis.frames.map((f) => ({
      timeSec: f.timeSec,
      thumbUrl: f.thumbUrl,
      input: f.input,
      assessment: compute(f.input),
    }));
  }, [analysis, methodId]);

  const stats = useMemo(() => {
    if (!scored.length) return null;
    const scores = scored.map((s) => s.assessment.grandScore);
    const max = scored[0].assessment.maxScore;
    const peak = scored.reduce((a, b) => (b.assessment.grandScore > a.assessment.grandScore ? b : a));
    const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
    const highCount = scored.filter((s) => s.assessment.riskBand === "high" || s.assessment.riskBand === "veryhigh").length;
    return { peak, mean, highPct: Math.round((highCount / scored.length) * 100), maxScore: max };
  }, [scored]);

  // Recapture the worst frame at high resolution whenever it changes (e.g.
  // after a method switch moves the peak to a different timestamp).
  useEffect(() => {
    const t = stats?.peak.timeSec;
    if (t === undefined) return;
    let alive = true;
    setWorstHiRes(null);
    void captureFrameHiRes(videoUrl, t).then((url) => {
      if (alive && url) setWorstHiRes(url);
    });
    return () => {
      alive = false;
    };
  }, [videoUrl, stats?.peak.timeSec]);

  const seek = (t: number) => {
    const v = videoRef.current;
    if (v) {
      v.currentTime = t;
      setPlayhead(t);
    }
  };

  const exportPdf = async () => {
    if (!stats) return;
    setExporting(true);
    setExportError(null);
    try {
      const report: VideoPdfReport = {
        fileName,
        method: stats.peak.assessment.method,
        maxScore: stats.maxScore,
        durationSec: analysis.sampledDurationSec,
        framesAnalyzed: scored.length,
        skipped: analysis.skippedNoPose + analysis.skippedLowConfidence,
        timeline: scored.map((s) => ({ timeSec: s.timeSec, grandScore: s.assessment.grandScore, riskBand: s.assessment.riskBand })),
        stats: {
          peakScore: stats.peak.assessment.grandScore,
          peakTimeSec: stats.peak.timeSec,
          peakLabel: stats.peak.assessment.riskLabel,
          peakBand: stats.peak.assessment.riskBand,
          mean: stats.mean,
          highPct: stats.highPct,
        },
        worst: {
          timeSec: stats.peak.timeSec,
          // Prefer the high-res recapture; the 320px timeline thumb is the fallback.
          thumbUrl: worstHiRes ?? stats.peak.thumbUrl,
          assessment: stats.peak.assessment,
          input: stats.peak.input,
        },
      };
      await exportVideoPdfReport(report, reportMeta);
    } catch (e) {
      setExportError((e as Error).message || "Could not generate the PDF.");
    } finally {
      setExporting(false);
    }
  };

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const onTime = () => setPlayhead(v.currentTime);
    v.addEventListener("timeupdate", onTime);
    return () => v.removeEventListener("timeupdate", onTime);
  }, []);

  return (
    <div className="mx-auto w-full max-w-4xl">
      <div className="mb-4 flex flex-wrap items-center gap-4">
        <h2 className="text-xl font-semibold">Video analysis</h2>
        <div role="tablist" aria-label="Assessment method" className="glass inline-flex rounded-lg p-0.5">
          {methods.map((m) => (
            <button
              key={m.id}
              type="button"
              role="tab"
              aria-selected={methodId === m.id}
              onClick={() => onMethodChange(m.id)}
              className={
                "rounded-md px-3 py-1 text-sm font-medium transition-colors " +
                (methodId === m.id ? "bg-primary text-primary-foreground shadow-glow-sm" : "text-muted-foreground hover:text-foreground")
              }
            >
              {m.name}
            </button>
          ))}
        </div>
        {scored.length > 0 && (
          <div className="ml-auto flex items-center gap-2">
            <Button variant="outline" onClick={exportPdf} disabled={exporting}>
              {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
              PDF
            </Button>
            <Button
              variant="outline"
              onClick={() => downloadText(`ergo-ai-${methodId}-video-data.csv`, "text/csv", videoCsv(analysis, methodId, fileName))}
            >
              CSV
            </Button>
          </div>
        )}
      </div>
      {exportError && <p className="mb-3 text-sm text-destructive">Could not generate the PDF: {exportError}</p>}

      {!scored.length ? (
        <div className="flex items-center gap-2 rounded-xl border px-5 py-6 text-sm text-amber-600">
          <AlertTriangle className="h-4 w-4" /> No pose was detected in this clip. Try a clearer, full-body side view.
        </div>
      ) : (
        <>
          <video
            ref={videoRef}
            src={videoUrl}
            controls
            className="mx-auto block max-h-[420px] max-w-full rounded-xl border bg-black"
          />

          <Timeline scored={scored} playhead={playhead} onSeek={seek} />

          {stats && (
            <div className="mt-4 grid grid-cols-3 gap-3">
              <Stat
                label="peak score"
                value={`${stats.peak.assessment.grandScore} / ${stats.maxScore}`}
                sub={`at ${fmtTime(stats.peak.timeSec)} · ${stats.peak.assessment.riskLabel}`}
                riskBand={stats.peak.assessment.riskBand}
                onClick={() => seek(stats.peak.timeSec)}
              />
              <Stat label="mean score" value={stats.mean.toFixed(1)} sub={`across ${scored.length} frames`} />
              <Stat label="time at high risk" value={`${stats.highPct}%`} sub="high / very-high band" />
            </div>
          )}

          {analysis.skippedNoPose + analysis.skippedLowConfidence + analysis.unreadableFrames > 0 && (
            <p className="mt-2 text-xs text-muted-foreground">
              {analysis.skippedNoPose + analysis.skippedLowConfidence + analysis.unreadableFrames} sampled frame
              {analysis.skippedNoPose + analysis.skippedLowConfidence + analysis.unreadableFrames > 1 ? "s" : ""} skipped
              {analysis.skippedNoPose > 0 && ` · ${analysis.skippedNoPose} with no detectable pose`}
              {analysis.skippedLowConfidence > 0 && ` · ${analysis.skippedLowConfidence} occluded (low visibility)`}
              {analysis.unreadableFrames > 0 && ` · ${analysis.unreadableFrames} unreadable`}
              . Angles are smoothed over a 2.5 s window.
            </p>
          )}

          {(analysis.temporal.repeated || analysis.temporal.sustained) && (
            <p className="mt-3 rounded-lg bg-primary/5 px-4 py-2 text-sm text-foreground">
              <strong className="font-medium">Detected over the clip:</strong>{" "}
              {analysis.temporal.repeated ? "repeated motion" : "posture held"} — applied as muscle use / activity in
              every frame&apos;s score.
            </p>
          )}

          {stats && (
            <div className="mt-4 overflow-hidden rounded-xl border bg-card">
              <MeasurementSummary
                method={stats.peak.assessment.method}
                input={stats.peak.input}
                wristMeasured={analysis.wristMeasured}
                staticRepetition={analysis.temporal.repeated || analysis.temporal.sustained ? "detected" : "assumed"}
              />
            </div>
          )}

          {stats && (
            <div className="mt-6">
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-sm font-semibold">Worst frame · {fmtTime(stats.peak.timeSec)}</h3>
                <button
                  type="button"
                  onClick={() => seek(stats.peak.timeSec)}
                  className="text-xs text-muted-foreground underline-offset-2 hover:underline"
                >
                  jump to this moment
                </button>
              </div>
              <div className="overflow-hidden rounded-xl border ring-1 ring-risk-high">
                <img
                  src={worstHiRes ?? stats.peak.thumbUrl}
                  alt="worst frame"
                  className="aspect-video w-full bg-muted object-contain"
                />
                <div className="border-t">
                  <Scorecard result={stats.peak.assessment} />
                </div>
                <RecommendationsPanel result={stats.peak.assessment} input={stats.peak.input} />
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  sub,
  riskBand,
  onClick,
}: {
  label: string;
  value: string;
  sub: string;
  riskBand?: RiskBand;
  onClick?: () => void;
}) {
  const inner = (
    <>
      <div className={cn("hud-readout text-2xl font-semibold", riskBand ? RISK_TEXT_CLASSES[riskBand] : "text-foreground")}>
        {value}
      </div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-[11px] text-muted-foreground/80">{sub}</div>
    </>
  );
  return (
    <div className="glass rounded-xl p-4 text-center">
      {onClick ? (
        <button type="button" onClick={onClick} className="w-full rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring">
          {inner}
        </button>
      ) : (
        <div>{inner}</div>
      )}
    </div>
  );
}

/** Clickable SVG strip: one bar per frame, height ∝ score, coloured by risk band. */
function Timeline({ scored, playhead, onSeek }: { scored: ScoredFrame[]; playhead: number; onSeek: (t: number) => void }) {
  const W = 1000;
  const H = 120;
  const last = scored[scored.length - 1]?.timeSec || 1;
  const span = Math.max(last, 0.001);
  const barW = (W / scored.length) * 0.8;
  const maxScore = scored[0]?.assessment.maxScore || 7;

  return (
    <div className="mt-4">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className="h-28 w-full cursor-pointer rounded-lg border bg-muted/20 grid-bg"
        role="img"
        aria-label="Risk score over time"
        onClick={(e) => {
          const rect = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
          const frac = (e.clientX - rect.left) / rect.width;
          onSeek(Math.max(0, Math.min(span, frac * span)));
        }}
      >
        {scored.map((s, i) => {
          const x = (i / scored.length) * W;
          const h = (s.assessment.grandScore / maxScore) * (H - 12);
          return (
            <rect
              key={i}
              x={x}
              y={H - h}
              width={barW}
              height={h}
              rx={1}
              className={RISK_FILL_CLASSES[s.assessment.riskBand]}
            />
          );
        })}
        {/* playhead */}
        <line
          x1={(playhead / span) * W}
          x2={(playhead / span) * W}
          y1={0}
          y2={H}
          stroke="hsl(var(--foreground))"
          strokeWidth={2}
          opacity={0.5}
        />
      </svg>
      <div className="mt-1 flex justify-between text-[11px] text-muted-foreground">
        <span>0:00</span>
        <span>{fmtTime(span)}</span>
      </div>
    </div>
  );
}
