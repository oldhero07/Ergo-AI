import { useState } from "react";
import { Settings2, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { MAX_DURATION_SEC, DEFAULT_DURATION_SEC, SAMPLE_FPS, MAX_EDGE } from "@/lib/videoConfig";

/**
 * User-adjustable video analysis settings. All values are advisory — the
 * device-aware budget in budget.ts may clamp fps / maxEdge on low-memory
 * devices, and videoFrames.ts enforces the absolute MAX_DURATION_SEC ceiling.
 */

export interface VideoSettingsValues {
  /** Seconds of the clip to analyze. */
  durationSec: number;
  /** Frames sampled per second. */
  fps: number;
  /** Longest edge each frame is downscaled to before pose detection. */
  maxEdge: number;
}

export const DEFAULT_VIDEO_SETTINGS: VideoSettingsValues = {
  durationSec: DEFAULT_DURATION_SEC,
  fps: SAMPLE_FPS,
  maxEdge: MAX_EDGE,
};

const FPS_OPTIONS = [
  { value: 2, label: "2 fps — faster, lighter" },
  { value: 3, label: "3 fps — balanced" },
  { value: 4, label: "4 fps — highest detail" },
];

const RES_OPTIONS = [
  { value: 480, label: "480p — fastest" },
  { value: 640, label: "640p — balanced" },
  { value: 720, label: "720p — highest quality" },
];

interface VideoSettingsProps {
  settings: VideoSettingsValues;
  onChange: (settings: VideoSettingsValues) => void;
  /** True when the device budget constrains some settings. */
  budgetReduced?: boolean;
}

export function VideoSettings({ settings, onChange, budgetReduced }: VideoSettingsProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="mt-5 rounded-2xl border bg-card/65 backdrop-blur-sm transition-all duration-200">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between px-5 py-3.5 text-sm font-semibold text-foreground outline-none group"
      >
        <span className="flex items-center gap-2">
          <Settings2 className="h-4 w-4 text-primary group-hover:scale-110 transition-transform" />
          Analysis Settings
        </span>
        <span className="rounded-md bg-secondary/60 hover:bg-secondary px-2.5 py-1 text-xs text-muted-foreground transition-colors">
          {open ? "Hide" : "Customize"}
        </span>
      </button>

      {open && (
        <div className="animate-in fade-in slide-in-from-top-1 duration-200 border-t px-5 pb-5 pt-4 space-y-5">
          {/* Duration slider */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label htmlFor="vid-duration" className="text-xs font-semibold uppercase tracking-wider text-foreground">
                Clip Duration
              </label>
              <span className="font-mono text-xs text-primary font-semibold">{settings.durationSec}s</span>
            </div>
            <input
              id="vid-duration"
              type="range"
              min={10}
              max={MAX_DURATION_SEC}
              step={5}
              value={settings.durationSec}
              onChange={(e) => onChange({ ...settings, durationSec: Number(e.target.value) })}
              className="w-full accent-primary cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
              <span>10s</span>
              <span>{MAX_DURATION_SEC}s</span>
            </div>
            <div className="mt-2 flex items-start gap-1.5 text-[11px] text-muted-foreground">
              <Info className="h-3.5 w-3.5 mt-0.5 shrink-0 text-primary/70" />
              <span>
                RULA specifies observing the posture for one minute. Longer clips capture repetition and sustained
                postures more reliably — 60 s reaches RULA's criterion.
              </span>
            </div>
          </div>

          {/* Sample rate */}
          <div>
            <label htmlFor="vid-fps" className="block text-xs font-semibold uppercase tracking-wider text-foreground mb-2">
              Sample Rate
            </label>
            <select
              id="vid-fps"
              value={settings.fps}
              onChange={(e) => onChange({ ...settings, fps: Number(e.target.value) })}
              className={cn(
                "w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none transition-colors",
                "focus:ring-2 focus:ring-ring",
              )}
            >
              {FPS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Resolution */}
          <div>
            <label htmlFor="vid-res" className="block text-xs font-semibold uppercase tracking-wider text-foreground mb-2">
              Frame Resolution
            </label>
            <select
              id="vid-res"
              value={settings.maxEdge}
              onChange={(e) => onChange({ ...settings, maxEdge: Number(e.target.value) })}
              className={cn(
                "w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none transition-colors",
                "focus:ring-2 focus:ring-ring",
              )}
            >
              {RES_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {budgetReduced && (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-[11px] text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
              This device has limited memory — the engine may lower sample rate and resolution automatically
              to prevent crashes. Scoring thresholds are unchanged.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
