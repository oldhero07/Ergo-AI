import { useCallback, useEffect, useRef, useState } from "react";
import { Upload, X, Images, Play, Trash2, Loader2, Camera, Video, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { VideoSettings, type VideoSettingsValues } from "@/components/VideoSettings";
import { cn } from "@/lib/utils";
import { isVideoFile } from "@/lib/videoFile";
import { MAX_VIDEO_MB } from "@/lib/videoConfig";
import type { AnalysisMode, UploadItem } from "@/types";

/**
 * Thumbnail tile. Chrome/Firefox can't render an iPhone HEIC in an <img>, so the
 * raw object URL fails to load - but the file IS attached and will be decoded
 * (heic-to / libheif) at analysis time. Rather than show a broken-image glyph
 * (which reads as "upload failed"), fall back to a labelled placeholder so it's
 * clear the photo is queued and will be analyzed.
 */
function Thumb({ url, name, converting }: { url: string; name: string; converting?: boolean }) {
  const [failed, setFailed] = useState(false);
  if (converting) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-1.5 p-2 text-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        <span className="line-clamp-2 break-all text-[10px] leading-tight text-muted-foreground">{name}</span>
        <span className="text-[9px] text-muted-foreground/70">decoding HEIC…</span>
      </div>
    );
  }
  if (failed) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-1 p-2 text-center">
        <Images className="h-5 w-5 text-muted-foreground" />
        <span className="line-clamp-2 break-all text-[10px] leading-tight text-muted-foreground">{name}</span>
        <span className="text-[9px] text-muted-foreground/70">queued · preview not supported</span>
      </div>
    );
  }
  return <img src={url} alt={name} onError={() => setFailed(true)} className="h-full w-full object-cover" />;
}

interface UploaderProps {
  mode: AnalysisMode;
  onSwitchMode: (m: AnalysisMode) => void;
  items: UploadItem[];
  onAddFiles: (files: File[]) => void;
  onVideo?: (file: File) => void;
  onRemove: (id: string) => void;
  onClear: () => void;
  onAnalyze: () => void;
  onUseSample?: (key: "office" | "warehouse" | "assembly") => void;
  videoSettings?: VideoSettingsValues;
  onVideoSettingsChange?: (s: VideoSettingsValues) => void;
  budgetReduced?: boolean;
}

export function Uploader({
  mode,
  onSwitchMode,
  items,
  onAddFiles,
  onVideo,
  onRemove,
  onClear,
  onAnalyze,
  onUseSample,
  videoSettings,
  onVideoSettingsChange,
  budgetReduced,
}: UploaderProps) {
  const [dragging, setDragging] = useState(false);
  const [wrongType, setWrongType] = useState<"image" | "video" | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const isVideoMode = mode === "video";

  const handleFiles = useCallback(
    (list: FileList | null) => {
      if (!list) return;
      const arr = Array.from(list);
      const video = arr.find(isVideoFile);
      const images = arr.filter((f) => !isVideoFile(f));
      setWrongType(null);
      if (isVideoMode) {
        if (video && onVideo) return onVideo(video);
        if (images.length) return setWrongType("image");
      } else {
        if (images.length) return onAddFiles(images);
        if (video) return setWrongType("video");
      }
    },
    [isVideoMode, onAddFiles, onVideo],
  );

  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const files = e.clipboardData?.files;
      if (files && files.length) handleFiles(files);
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [handleFiles]);

  return (
    <div className="mx-auto w-full max-w-3xl">
      {/* Photo / Video mode switch */}
      <div
        role="tablist"
        aria-label="Analysis mode"
        className="glass mx-auto mb-6 inline-flex rounded-xl p-1"
      >
        <ModeTab active={!isVideoMode} icon={<Camera className="h-4 w-4" />} label="Photo" onClick={() => onSwitchMode("photo")} />
        <ModeTab active={isVideoMode} icon={<Video className="h-4 w-4" />} label="Video" onClick={() => onSwitchMode("video")} />
      </div>

      <div
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          handleFiles(e.dataTransfer.files);
        }}
        className={cn(
          "glass flex flex-col items-center justify-center rounded-3xl border-2 border-dashed px-6 py-14 text-center transition-all cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-ring",
          dragging ? "border-primary shadow-glow-sm" : "border-border hover:border-primary/50 hover:bg-accent/40",
        )}
      >
        <div className="mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-primary/10 text-primary">
          {isVideoMode ? <Video className="h-6 w-6" /> : <Upload className="h-6 w-6" />}
        </div>
        <p className="text-base font-medium">
          {isVideoMode ? "Drag & drop a video here" : "Drag & drop photos here"}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          {isVideoMode ? "or click to browse - one short clip" : "or click to browse · paste from clipboard · one or many"}
        </p>
        <p className="mt-3 text-xs text-muted-foreground">
          {isVideoMode
            ? `MP4, MOV, or WebM · up to ${MAX_VIDEO_MB} MB · first ${videoSettings?.durationSec ?? 30}s analyzed`
            : "JPG, PNG, or iPhone HEIC"}
        </p>
        <input
          ref={inputRef}
          type="file"
          accept={isVideoMode ? "video/*,.mp4,.mov,.webm,.m4v" : "image/*,.heic,.heif"}
          multiple={!isVideoMode}
          className="hidden"
          onChange={(e) => {
            handleFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {isVideoMode && videoSettings && onVideoSettingsChange && (
        <VideoSettings settings={videoSettings} onChange={onVideoSettingsChange} budgetReduced={budgetReduced} />
      )}

      {wrongType && (
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2 rounded-xl border bg-amber-50 px-4 py-3 text-center text-sm text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
          {wrongType === "video" ? "That's a video." : "That's an image."}
          <button
            type="button"
            onClick={() => {
              setWrongType(null);
              onSwitchMode(wrongType === "video" ? "video" : "photo");
            }}
            className="inline-flex items-center gap-1 font-medium text-primary underline-offset-2 hover:underline"
          >
            Switch to {wrongType === "video" ? "Video" : "Photo"} analysis <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {!isVideoMode && onUseSample && items.length === 0 && (
        <div className="mt-6 border-t pt-4 text-center">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
            Or test with a sample scenario:
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <button
              type="button"
              onClick={() => onUseSample("office")}
              className="glass inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all hover:shadow-glow-sm hover:text-foreground"
            >
              💻 Office Desk Work
            </button>
            <button
              type="button"
              onClick={() => onUseSample("warehouse")}
              className="glass inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all hover:shadow-glow-sm hover:text-foreground"
            >
              📦 Warehouse Lifting
            </button>
            <button
              type="button"
              onClick={() => onUseSample("assembly")}
              className="glass inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all hover:shadow-glow-sm hover:text-foreground"
            >
              ⚙️ Assembly Standing
            </button>
          </div>
        </div>
      )}

      {!isVideoMode && items.length > 0 && (
        <div className="mt-6">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              <Images className="mr-1.5 inline h-4 w-4 align-[-3px]" />
              {items.length} photo{items.length > 1 ? "s" : ""} ready
            </p>
            <Button variant="ghost" size="sm" onClick={onClear}>
              <Trash2 className="h-4 w-4" /> Clear
            </Button>
          </div>
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5">
            {items.map((it) => (
              <div key={it.id} className="group relative aspect-square overflow-hidden rounded-xl bg-muted ring-1 ring-border transition-all hover:ring-primary/50">
                <Thumb key={it.url} url={it.url} name={it.file.name} converting={it.converting} />
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemove(it.id);
                  }}
                  className="absolute right-1 top-1 grid h-6 w-6 place-items-center rounded-full bg-background/80 text-foreground opacity-0 transition-opacity group-hover:opacity-100"
                  aria-label={`Remove ${it.file.name}`}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
          <div className="mt-6 flex justify-center">
            <Button size="lg" onClick={onAnalyze}>
              <Play className="h-4 w-4" /> Analyze {items.length > 1 ? `${items.length} photos` : "photo"}
            </Button>
          </div>
        </div>
      )}

      {/* Camera Guidance Expandable Panel */}
      {!isVideoMode && <PhotoGuide />}
    </div>
  );
}

function ModeTab({ active, icon, label, onClick }: { active: boolean; icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-2 rounded-lg px-4 py-1.5 font-mono text-xs uppercase tracking-wider transition-all",
        active ? "bg-primary text-primary-foreground shadow-glow-sm" : "text-muted-foreground hover:text-foreground",
      )}
    >
      {icon}
      {label}
    </button>
  );
}

function PhotoGuide() {
  const [isOpen, setIsOpen] = useState(true);

  return (
    <div className="mt-8 rounded-2xl border bg-card/65 p-5 text-left shadow-sm backdrop-blur-sm transition-all duration-200">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between font-semibold text-sm text-foreground outline-none group"
      >
        <span className="flex items-center gap-2">
          <Camera className="h-4.5 w-4.5 text-primary group-hover:scale-110 transition-transform" />
          Photo Capture Guidelines for RULA/REBA Accuracy
        </span>
        <span className="rounded-md bg-secondary/60 hover:bg-secondary px-2.5 py-1 text-xs text-muted-foreground transition-colors">
          {isOpen ? "Hide Guide" : "Show Guide"}
        </span>
      </button>

      {isOpen && (
        <div className="mt-5 grid gap-5 sm:grid-cols-3 animate-in fade-in slide-in-from-top-1 duration-200">
          
          {/* Card 1: Side View profile */}
          <div className="rounded-xl border bg-card/40 p-3.5 flex flex-col gap-3">
            <h4 className="font-semibold text-xs text-foreground uppercase tracking-wider">1. View Orientation</h4>
            <div className="aspect-[4/3] rounded-lg bg-secondary/30 flex items-center justify-center border border-border/40 overflow-hidden">
              <svg viewBox="0 0 100 80" className="w-full h-full text-muted-foreground">
                {/* Correct Side View (Green) */}
                <g transform="translate(12, 5)">
                  <circle cx="15" cy="15" r="4.5" className="fill-risk-low/10 stroke-risk-low" strokeWidth="1.5" />
                  <path d="M 15 19.5 C 13.5 28 14 36 15 44 L 12 70" fill="none" className="stroke-risk-low" strokeWidth="2.2" strokeLinecap="round" />
                  <path d="M 15 21 L 22 34 L 18 46" fill="none" className="stroke-risk-low" strokeWidth="2" strokeLinecap="round" />
                  <circle cx="28" cy="62" r="5.5" className="fill-risk-low" />
                  <path d="M 26 62 L 27.5 63.5 L 30 60.5" fill="none" className="stroke-primary-foreground" strokeWidth="1.2" strokeLinecap="round" />
                </g>
                {/* Incorrect Front View (Red) */}
                <g transform="translate(54, 5)" opacity="0.3">
                  <circle cx="15" cy="15" r="4.5" className="fill-risk-veryhigh/10 stroke-risk-veryhigh" strokeWidth="1.5" />
                  <path d="M 15 19.5 L 15 44 M 10 44 L 10 70 M 20 44 L 20 70" className="stroke-risk-veryhigh" strokeWidth="2" strokeLinecap="round" />
                  <path d="M 9 21 L 5 36 M 21 21 L 25 36" className="stroke-risk-veryhigh" strokeWidth="1.8" strokeLinecap="round" />
                  <circle cx="28" cy="62" r="5.5" className="fill-risk-veryhigh" />
                  <path d="M 26 60 L 30 64 M 30 60 L 26 64" className="stroke-primary-foreground" strokeWidth="1.2" strokeLinecap="round" />
                </g>
              </svg>
            </div>
            <ul className="text-xs space-y-1 text-muted-foreground font-medium">
              <li className="text-risk-low">✅ Side view (90° profile)</li>
              <li className="text-risk-veryhigh">❌ Avoid frontal or diagonal shots</li>
            </ul>
          </div>

          {/* Card 2: Camera Height */}
          <div className="rounded-xl border bg-card/40 p-3.5 flex flex-col gap-3">
            <h4 className="font-semibold text-xs text-foreground uppercase tracking-wider">2. Camera Height</h4>
            <div className="aspect-[4/3] rounded-lg bg-secondary/30 flex items-center justify-center border border-border/40 overflow-hidden">
              <svg viewBox="0 0 100 80" className="w-full h-full text-muted-foreground">
                {/* Person */}
                <g transform="translate(68, 5)">
                  <circle cx="10" cy="15" r="4.5" className="fill-muted-foreground/10 stroke-muted-foreground" strokeWidth="1.2" />
                  <path d="M 10 19.5 Q 8.5 28 10 44 L 7 70" fill="none" className="stroke-muted-foreground" strokeWidth="1.8" />
                  <path d="M 10 21 L 16 34 L 12 46" fill="none" className="stroke-muted-foreground" strokeWidth="1.8" strokeLinecap="round" />
                </g>
                {/* Good camera (horizontal at waist) */}
                <g transform="translate(8, 30)">
                  <rect x="0" y="5" width="14" height="9" rx="2" className="fill-risk-low/10 stroke-risk-low" strokeWidth="1.2" />
                  <circle cx="7" cy="9.5" r="2.2" className="fill-none stroke-risk-low" strokeWidth="1" />
                  <path d="M 14 9.5 L 68 9.5" className="stroke-risk-low" strokeWidth="1.5" strokeDasharray="3 3" />
                  <circle cx="34" cy="9.5" r="5.5" className="fill-risk-low" />
                  <path d="M 32 9.5 L 33.5 11 L 36 8" fill="none" className="stroke-primary-foreground" strokeWidth="1.2" strokeLinecap="round" />
                </g>
                {/* Bad camera (overhead angle) */}
                <g transform="translate(8, -6)" opacity="0.3">
                  <rect x="0" y="5" width="14" height="9" rx="2" className="fill-risk-veryhigh/10 stroke-risk-veryhigh" strokeWidth="1.2" transform="rotate(25 7 9)" />
                  <path d="M 14 12 L 72 38" className="stroke-risk-veryhigh" strokeWidth="1.5" strokeDasharray="3 3" />
                  <circle cx="38" cy="22" r="5.5" className="fill-risk-veryhigh" />
                  <path d="M 36 20 L 40 24 M 40 20 L 36 24" className="stroke-primary-foreground" strokeWidth="1.2" strokeLinecap="round" />
                </g>
              </svg>
            </div>
            <ul className="text-xs space-y-1 text-muted-foreground font-medium">
              <li className="text-risk-low">✅ Lens at subject's waist level</li>
              <li className="text-risk-veryhigh">❌ Avoid high overhead/low angles</li>
            </ul>
          </div>

          {/* Card 3: Framing */}
          <div className="rounded-xl border bg-card/40 p-3.5 flex flex-col gap-3">
            <h4 className="font-semibold text-xs text-foreground uppercase tracking-wider">3. Full Body Framing</h4>
            <div className="aspect-[4/3] rounded-lg bg-secondary/30 flex items-center justify-center border border-border/40 overflow-hidden">
              <svg viewBox="0 0 100 80" className="w-full h-full text-muted-foreground">
                {/* Correct Full Body */}
                <g transform="translate(10, 5)">
                  <rect x="0" y="5" width="28" height="66" rx="4" fill="none" className="stroke-risk-low" strokeWidth="1.2" strokeDasharray="3 3" />
                  <g transform="translate(4, 5)">
                    <circle cx="10" cy="10" r="4" className="fill-risk-low/10 stroke-risk-low" strokeWidth="1.2" />
                    <path d="M 10 14 L 10 38 L 6 56 M 10 38 L 14 56" className="stroke-risk-low" strokeWidth="1.8" />
                    <path d="M 10 16 L 16 26 L 12 36" fill="none" className="stroke-risk-low" strokeWidth="1.8" strokeLinecap="round" />
                  </g>
                  <circle cx="28" cy="62" r="5.5" className="fill-risk-low" />
                  <path d="M 26 62 L 27.5 63.5 L 30 60.5" fill="none" className="stroke-primary-foreground" strokeWidth="1.2" strokeLinecap="round" />
                </g>
                {/* Incorrect Cropped */}
                <g transform="translate(56, 5)" opacity="0.3">
                  <rect x="0" y="5" width="28" height="66" rx="4" fill="none" className="stroke-risk-veryhigh" strokeWidth="1.2" strokeDasharray="3 3" />
                  <g transform="translate(4, 5)">
                    <circle cx="10" cy="10" r="4" className="fill-risk-veryhigh/10 stroke-risk-veryhigh" strokeWidth="1.2" />
                    {/* leg truncated by crop line */}
                    <path d="M 10 14 L 10 38 L 8 45" className="stroke-risk-veryhigh" strokeWidth="1.8" strokeLinecap="round" />
                    <path d="M 10 16 L 16 26 L 14 28" fill="none" className="stroke-risk-veryhigh" strokeWidth="1.8" strokeLinecap="round" />
                    {/* red crop cut line */}
                    <line x1="-8" y1="42" x2="28" y2="42" className="stroke-risk-veryhigh" strokeWidth="1.5" strokeDasharray="2 2" />
                  </g>
                  <circle cx="28" cy="62" r="5.5" className="fill-risk-veryhigh" />
                  <path d="M 26 60 L 30 64 M 30 60 L 26 64" className="stroke-primary-foreground" strokeWidth="1.2" strokeLinecap="round" />
                </g>
              </svg>
            </div>
            <ul className="text-xs space-y-1 text-muted-foreground font-medium">
              <li className="text-risk-low">✅ Entire body in frame (head to toe)</li>
              <li className="text-risk-veryhigh">❌ Avoid cropped limbs or hands</li>
            </ul>
          </div>

        </div>
      )}
    </div>
  );
}
