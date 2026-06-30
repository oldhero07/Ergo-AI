import { useMemo, useRef, useState, useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import type { VideoAnalysis } from "@/lib/analyze";
import type { AssessmentResult } from "@/assessment/types";
import { getMethod, methods } from "@/assessment/registry";
import { RISK_META } from "@/lib/risk";
import { Scorecard } from "@/components/Scorecard";

interface ScoredFrame {
  timeSec: number;
  thumbUrl: string;
  assessment: AssessmentResult;
}

const fmtTime = (s: number) => {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${String(sec).padStart(2, "0")}`;
};

/** Risk-over-time view for an analyzed video: player + clickable timeline of
 * grand scores, peak/mean/time-in-high-risk stats, and the worst frame's score.
 * Scores are recomputed from each frame's PostureInput for the active method. */
export function VideoResults({
  videoUrl,
  analysis,
  methodId,
  onMethodChange,
}: {
  videoUrl: string;
  analysis: VideoAnalysis;
  methodId: string;
  onMethodChange: (id: string) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playhead, setPlayhead] = useState(0);

  const scored: ScoredFrame[] = useMemo(() => {
    const compute = getMethod(methodId).compute;
    return analysis.frames.map((f) => ({
      timeSec: f.timeSec,
      thumbUrl: f.thumbUrl,
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

  const seek = (t: number) => {
    const v = videoRef.current;
    if (v) {
      v.currentTime = t;
      setPlayhead(t);
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
        <div role="tablist" aria-label="Assessment method" className="inline-flex rounded-lg border p-0.5">
          {methods.map((m) => (
            <button
              key={m.id}
              type="button"
              role="tab"
              aria-selected={methodId === m.id}
              onClick={() => onMethodChange(m.id)}
              className={
                "rounded-md px-3 py-1 text-sm font-medium transition-colors " +
                (methodId === m.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")
              }
            >
              {m.name}
            </button>
          ))}
        </div>
      </div>

      {!scored.length ? (
        <div className="flex items-center gap-2 rounded-xl border px-5 py-6 text-sm text-amber-600">
          <AlertTriangle className="h-4 w-4" /> No pose was detected in this clip. Try a clearer, full-body side view.
        </div>
      ) : (
        <>
          <video ref={videoRef} src={videoUrl} controls className="w-full rounded-xl border bg-black" />

          <Timeline scored={scored} playhead={playhead} onSeek={seek} />

          {stats && (
            <div className="mt-4 grid grid-cols-3 gap-3 rounded-lg border bg-muted/30 p-4 text-center">
              <Stat
                label="peak score"
                value={`${stats.peak.assessment.grandScore} / ${stats.maxScore}`}
                sub={`at ${fmtTime(stats.peak.timeSec)} · ${stats.peak.assessment.riskLabel}`}
                color={RISK_META[stats.peak.assessment.riskBand].color}
                onClick={() => seek(stats.peak.timeSec)}
              />
              <Stat label="mean score" value={stats.mean.toFixed(1)} sub={`across ${scored.length} frames`} />
              <Stat label="time at high risk" value={`${stats.highPct}%`} sub="high / very-high band" />
            </div>
          )}

          {analysis.skippedNoPose > 0 && (
            <p className="mt-2 text-xs text-muted-foreground">
              {analysis.skippedNoPose} sampled frame{analysis.skippedNoPose > 1 ? "s" : ""} had no detectable pose and{" "}
              {analysis.skippedNoPose > 1 ? "were" : "was"} skipped.
            </p>
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
              <div className="overflow-hidden rounded-xl border">
                <img src={stats.peak.thumbUrl} alt="worst frame" className="aspect-video w-full bg-muted object-contain" />
                <div className="border-t">
                  <Scorecard result={stats.peak.assessment} />
                </div>
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
  color,
  onClick,
}: {
  label: string;
  value: string;
  sub: string;
  color?: string;
  onClick?: () => void;
}) {
  const inner = (
    <>
      <div className="text-2xl font-semibold tabular-nums" style={color ? { color } : undefined}>
        {value}
      </div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-[11px] text-muted-foreground/80">{sub}</div>
    </>
  );
  return onClick ? (
    <button type="button" onClick={onClick} className="rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring">
      {inner}
    </button>
  ) : (
    <div>{inner}</div>
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
        className="h-28 w-full cursor-pointer rounded-lg border bg-muted/20"
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
          return <rect key={i} x={x} y={H - h} width={barW} height={h} fill={RISK_META[s.assessment.riskBand].color} rx={1} />;
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
