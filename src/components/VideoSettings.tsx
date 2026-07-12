import { useState } from "react";
import { Settings2, Info } from "lucide-react";
import { MAX_DURATION_SEC, DEFAULT_DURATION_SEC, SAMPLE_FPS, MAX_EDGE } from "@/lib/videoConfig";

/**
 * User-adjustable video analysis settings. Only clip duration is a choice -
 * sampling rate and frame resolution are one fixed policy (videoConfig.ts)
 * now that inference runs server-side, so every clip is analyzed identically.
 */

export interface VideoSettingsValues {
  /** Seconds of the clip to analyze. */
  durationSec: number;
  /** Frames sampled per second (fixed policy; kept for the analyze call). */
  fps: number;
  /** Longest edge each frame is downscaled to (fixed policy). */
  maxEdge: number;
}

export const DEFAULT_VIDEO_SETTINGS: VideoSettingsValues = {
  durationSec: DEFAULT_DURATION_SEC,
  fps: SAMPLE_FPS,
  maxEdge: MAX_EDGE,
};

interface VideoSettingsProps {
  settings: VideoSettingsValues;
  onChange: (settings: VideoSettingsValues) => void;
}

export function VideoSettings({ settings, onChange }: VideoSettingsProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="mt-5 rounded-lg border bg-card shadow-card transition-all duration-200">
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
                postures more reliably — 60 s reaches RULA&apos;s criterion.
              </span>
            </div>
          </div>

          <p className="text-[11px] text-muted-foreground">
            Frames are sampled at {SAMPLE_FPS} fps and {MAX_EDGE}p.
          </p>
        </div>
      )}
    </div>
  );
}
