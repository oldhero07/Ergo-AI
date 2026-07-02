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

function CheckIcon() {
  return (
    <svg viewBox="0 0 12 12" className="inline mr-2 h-3.5 w-3.5 shrink-0 text-emerald-500 fill-emerald-500/10" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3.5 6 5 7.5 8.5 4" />
    </svg>
  );
}

function CrossIcon() {
  return (
    <svg viewBox="0 0 12 12" className="inline mr-2 h-3.5 w-3.5 shrink-0 text-rose-500 fill-rose-500/10" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="3.5" y1="3.5" x2="8.5" y2="8.5" />
      <line x1="8.5" y1="3.5" x2="3.5" y2="8.5" />
    </svg>
  );
}

function PhotoGuide() {
  const [isOpen, setIsOpen] = useState(true);

  return (
    <div className="mt-8 rounded-2xl border border-border bg-card/65 p-5 text-left shadow-sm backdrop-blur-sm transition-all duration-200">
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
          <div className="rounded-xl border border-border/50 bg-background/40 p-4 flex flex-col gap-3">
            <h4 className="font-semibold text-xs text-foreground uppercase tracking-wider">1. View Orientation</h4>
            <div className="aspect-[4/3] rounded-lg bg-muted/20 flex items-center justify-center border border-border/40 overflow-hidden relative">
              <svg viewBox="0 0 200 120" className="w-full h-full text-muted-foreground">
                <defs>
                  <pattern id="grid-1" width="10" height="10" patternUnits="userSpaceOnUse">
                    <circle cx="10" cy="10" r="0.5" fill="currentColor" opacity="0.15" />
                  </pattern>
                </defs>
                <rect width="200" height="120" fill="url(#grid-1)" />

                {/* Left: Side View (Correct) */}
                <g transform="translate(10, 10)">
                  <rect width="80" height="100" rx="8" fill="hsl(var(--background))" fillOpacity="0.5" stroke="hsl(var(--border))" strokeWidth="1" />
                  
                  {/* Figure Side Profile */}
                  <g transform="translate(35, 15)">
                    {/* Head */}
                    <circle cx="0" cy="0" r="6" fill="hsl(var(--primary))" />
                    {/* Spine */}
                    <path d="M 0 6 Q -2 20 0 35" fill="none" stroke="hsl(var(--primary))" strokeWidth="3.5" strokeLinecap="round" />
                    {/* Arm */}
                    <path d="M 0 10 L 5 25 L -2 38" fill="none" stroke="hsl(var(--primary))" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                    {/* Leg */}
                    <path d="M 0 35 L -3 60 M 0 35 L 5 60" fill="none" stroke="hsl(var(--primary))" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
                  </g>

                  {/* Camera icon pointing side */}
                  <g transform="translate(14, 46)" stroke="hsl(var(--primary))" strokeWidth="1.5" fill="none">
                    <rect x="0" y="4" width="10" height="7" rx="1.5" />
                    <path d="M 10 6 L 13 4 L 13 11 L 10 9 Z" fill="hsl(var(--primary))" fillOpacity="0.2" />
                  </g>
                  <line x1="28" y1="53.5" x2="42" y2="53.5" stroke="hsl(var(--primary))" strokeWidth="1.5" strokeDasharray="3 3" opacity="0.5" />
                  
                  {/* Status indicator */}
                  <g transform="translate(68, 88)">
                    <circle r="7" fill="#10b981" />
                    <path d="M -3 0 L -1 2 L 3 -2" fill="none" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" />
                  </g>
                </g>

                {/* Right: Front View (Incorrect) */}
                <g transform="translate(110, 10)">
                  <rect width="80" height="100" rx="8" fill="hsl(var(--background))" fillOpacity="0.5" stroke="hsl(var(--border))" strokeWidth="1" />
                  
                  {/* Figure Front Profile */}
                  <g transform="translate(40, 15)">
                    {/* Head */}
                    <circle cx="0" cy="0" r="6" fill="currentColor" opacity="0.6" />
                    {/* Spine */}
                    <line x1="0" y1="6" x2="0" y2="35" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" opacity="0.6" />
                    {/* Shoulders */}
                    <line x1="-8" y1="10" x2="8" y2="10" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" opacity="0.6" />
                    {/* Arms */}
                    <path d="M -8 10 L -10 25 L -6 38" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" opacity="0.6" />
                    <path d="M 8 10 L 10 25 L 6 38" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" opacity="0.6" />
                    {/* Legs */}
                    <path d="M -3 35 L -5 60 M 3 35 L 5 60" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.6" />
                  </g>
                  
                  {/* Status indicator */}
                  <g transform="translate(68, 88)">
                    <circle r="7" fill="#ef4444" />
                    <path d="M -2.5 -2.5 L 2.5 2.5 M 2.5 -2.5 L -2.5 2.5" fill="none" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" />
                  </g>
                </g>
              </svg>
            </div>
            <ul className="text-xs space-y-1.5 text-muted-foreground font-medium">
              <li className="flex items-start text-emerald-500 dark:text-emerald-400">
                <CheckIcon />
                <span className="text-foreground">Side view (90° profile)</span>
              </li>
              <li className="flex items-start text-rose-500 dark:text-rose-400">
                <CrossIcon />
                <span className="text-foreground">Avoid frontal or diagonal shots</span>
              </li>
            </ul>
          </div>

          {/* Card 2: Camera Height */}
          <div className="rounded-xl border border-border/50 bg-background/40 p-4 flex flex-col gap-3">
            <h4 className="font-semibold text-xs text-foreground uppercase tracking-wider">2. Camera Height</h4>
            <div className="aspect-[4/3] rounded-lg bg-muted/20 flex items-center justify-center border border-border/40 overflow-hidden relative">
              <svg viewBox="0 0 200 120" className="w-full h-full text-muted-foreground">
                <defs>
                  <pattern id="grid-2" width="10" height="10" patternUnits="userSpaceOnUse">
                    <circle cx="10" cy="10" r="0.5" fill="currentColor" opacity="0.15" />
                  </pattern>
                </defs>
                <rect width="200" height="120" fill="url(#grid-2)" />

                <g transform="translate(10, 10)">
                  <rect width="180" height="100" rx="8" fill="hsl(var(--background))" fillOpacity="0.5" stroke="hsl(var(--border))" strokeWidth="1" />
                  
                  {/* Figure */}
                  <g transform="translate(145, 15)">
                    <circle cx="0" cy="0" r="6" fill="currentColor" opacity="0.4" />
                    <path d="M 0 6 Q -2 20 0 35" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" opacity="0.4" />
                    <path d="M 0 10 L 5 25 L -2 38" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" opacity="0.4" />
                    <path d="M 0 35 L -3 60 M 0 35 L 5 60" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.4" />
                  </g>

                  {/* Ground line */}
                  <line x1="120" y1="75" x2="170" y2="75" stroke="currentColor" strokeWidth="1.5" opacity="0.2" />

                  {/* Level Camera (Waist height) */}
                  <g transform="translate(25, 45)">
                    <g stroke="hsl(var(--primary))" strokeWidth="1.5" fill="none">
                      <rect x="0" y="4" width="14" height="9" rx="2" />
                      <path d="M 14 6.5 L 18 4.5 L 18 12.5 L 14 10.5 Z" fill="hsl(var(--primary))" fillOpacity="0.2" />
                    </g>
                    <path d="M 18 8.5 L 115 8.5" stroke="hsl(var(--primary))" strokeWidth="1.5" strokeDasharray="4 4" opacity="0.7" />
                    <g transform="translate(70, -4)">
                      <circle r="6" fill="#10b981" />
                      <path d="M -2.5 0 L -1 1.5 L 2.5 -2" fill="none" stroke="#fff" strokeWidth="1.2" strokeLinecap="round" />
                    </g>
                  </g>

                  {/* Slanted Camera (Overhead height) */}
                  <g transform="translate(30, 10)">
                    <g transform="rotate(22 7 8)" stroke="currentColor" strokeWidth="1.5" fill="none" opacity="0.6">
                      <rect x="0" y="4" width="14" height="9" rx="2" />
                      <path d="M 14 6.5 L 18 4.5 L 18 12.5 L 14 10.5 Z" fill="currentColor" fillOpacity="0.2" />
                    </g>
                    <path d="M 18 13 L 110 40" stroke="currentColor" strokeWidth="1.5" strokeDasharray="4 4" opacity="0.4" />
                    <g transform="translate(60, 20)">
                      <circle r="6" fill="#ef4444" />
                      <path d="M -2 -2 L 2 2 M 2 -2 L -2 2" fill="none" stroke="#fff" strokeWidth="1.2" strokeLinecap="round" />
                    </g>
                  </g>
                </g>
              </svg>
            </div>
            <ul className="text-xs space-y-1.5 text-muted-foreground font-medium">
              <li className="flex items-start text-emerald-500 dark:text-emerald-400">
                <CheckIcon />
                <span className="text-foreground">Lens at subject's waist level</span>
              </li>
              <li className="flex items-start text-rose-500 dark:text-rose-400">
                <CrossIcon />
                <span className="text-foreground">Avoid high overhead/low angles</span>
              </li>
            </ul>
          </div>

          {/* Card 3: Framing */}
          <div className="rounded-xl border border-border/50 bg-background/40 p-4 flex flex-col gap-3">
            <h4 className="font-semibold text-xs text-foreground uppercase tracking-wider">3. Full Body Framing</h4>
            <div className="aspect-[4/3] rounded-lg bg-muted/20 flex items-center justify-center border border-border/40 overflow-hidden relative">
              <svg viewBox="0 0 200 120" className="w-full h-full text-muted-foreground">
                <defs>
                  <pattern id="grid-3" width="10" height="10" patternUnits="userSpaceOnUse">
                    <circle cx="10" cy="10" r="0.5" fill="currentColor" opacity="0.15" />
                  </pattern>
                </defs>
                <rect width="200" height="120" fill="url(#grid-3)" />

                {/* Left: Correct Full Body */}
                <g transform="translate(10, 10)">
                  <rect width="80" height="100" rx="8" fill="hsl(var(--background))" fillOpacity="0.5" stroke="hsl(var(--border))" strokeWidth="1" />
                  
                  {/* Viewfinder borders */}
                  <g stroke="hsl(var(--primary))" strokeWidth="1.5" fill="none" opacity="0.8">
                    <path d="M 8 18 L 8 12 L 14 12" />
                    <path d="M 72 12 L 78 12 L 78 18" />
                    <path d="M 8 82 L 8 88 L 14 88" />
                    <path d="M 72 88 L 78 88 L 78 82" />
                  </g>
                  
                  <g transform="translate(40, 20)">
                    <circle cx="0" cy="0" r="5" fill="hsl(var(--primary))" />
                    <path d="M 0 5 Q -2 16 0 28" fill="none" stroke="hsl(var(--primary))" strokeWidth="3" strokeLinecap="round" />
                    <path d="M 0 8 L 4 20 L -2 30" fill="none" stroke="hsl(var(--primary))" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M 0 28 L -3 48 M 0 28 L 4 48" fill="none" stroke="hsl(var(--primary))" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                  </g>

                  {/* Status indicator */}
                  <g transform="translate(68, 88)">
                    <circle r="7" fill="#10b981" />
                    <path d="M -3 0 L -1 2 L 3 -2" fill="none" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" />
                  </g>
                </g>

                {/* Right: Incorrect Cropped */}
                <g transform="translate(110, 10)">
                  <rect width="80" height="100" rx="8" fill="hsl(var(--background))" fillOpacity="0.5" stroke="hsl(var(--border))" strokeWidth="1" />
                  
                  {/* Viewfinder borders */}
                  <g stroke="currentColor" strokeWidth="1.5" fill="none" opacity="0.6">
                    <path d="M 8 18 L 8 12 L 14 12" />
                    <path d="M 72 12 L 78 12 L 78 18" />
                    <path d="M 8 82 L 8 88 L 14 88" />
                    <path d="M 72 88 L 78 88 L 78 82" />
                  </g>

                  <g transform="translate(40, 14)">
                    <circle cx="0" cy="0" r="5" fill="currentColor" opacity="0.6" />
                    <path d="M 0 5 Q -2 16 0 28" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" opacity="0.6" />
                    <path d="M 0 8 L 4 20 L -2 30" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" opacity="0.6" />
                    {/* Cut off legs */}
                    <path d="M 0 28 L -2 46 M 0 28 L 3 46" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" opacity="0.6" />
                    
                    {/* Crop indicator line */}
                    <line x1="-30" y1="46" x2="30" y2="46" stroke="#ef4444" strokeWidth="1.5" strokeDasharray="3 3" opacity="0.8" />
                  </g>

                  <text x="40" y="74" textAnchor="middle" fill="currentColor" className="font-semibold" style={{ fontSize: 7, opacity: 0.8 }}>CROPPED</text>

                  {/* Status indicator */}
                  <g transform="translate(68, 88)">
                    <circle r="7" fill="#ef4444" />
                    <path d="M -2.5 -2.5 L 2.5 2.5 M 2.5 -2.5 L -2.5 2.5" fill="none" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" />
                  </g>
                </g>
              </svg>
            </div>
            <ul className="text-xs space-y-1.5 text-muted-foreground font-medium">
              <li className="flex items-start text-emerald-500 dark:text-emerald-400">
                <CheckIcon />
                <span className="text-foreground">Entire body in frame (head to toe)</span>
              </li>
              <li className="flex items-start text-rose-500 dark:text-rose-400">
                <CrossIcon />
                <span className="text-foreground">Avoid cropped limbs or hands</span>
              </li>
            </ul>
          </div>

        </div>
      )}
    </div>
  );
}
