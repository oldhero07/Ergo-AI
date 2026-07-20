import { useCallback, useEffect, useRef, useState } from "react";
import { Upload, X, Images, Play, Trash2, Loader2, Camera, Video, ArrowRight, Monitor, Package, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { VideoSettings, type VideoSettingsValues } from "@/components/VideoSettings";
import { cn } from "@/lib/utils";
import { isVideoFile } from "@/lib/videoFile";
import { MAX_VIDEO_MB } from "@/lib/videoConfig";
import type { AnalysisMode, UploadItem } from "@/types";

/**
 * Thumbnail tile. Three states:
 *  - converting: the preview thumbnail is still being prepared (spinner).
 *  - done but no preview: a calm labelled placeholder so it's clear the photo
 *    is queued, not broken.
 *  - preview ready: the actual thumbnail image.
 */
function Thumb({ url, name, converting }: { url: string; name: string; converting?: boolean }) {
  const [failed, setFailed] = useState(false);
  if (converting) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-1.5 p-2 text-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        <span className="line-clamp-2 break-all text-[10px] leading-tight text-muted-foreground">{name}</span>
        <span className="text-[9px] text-muted-foreground/70">preparing preview…</span>
      </div>
    );
  }
  if (!url || failed) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-1 p-2 text-center">
        <Images className="h-5 w-5 text-muted-foreground" />
        <span className="line-clamp-2 break-all text-[10px] leading-tight text-muted-foreground">{name}</span>
        <span className="text-[9px] text-muted-foreground/70">queued · no preview on this browser</span>
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
  /** Batch-limit / skipped-files caution, shown right under the dropzone. */
  notice?: string | null;
  /** Photo-batch cap, surfaced in the dropzone hint. */
  maxBatch?: number;
  /** True while queued photos are still preparing - Analyze waits for them. */
  preparing?: boolean;
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
  notice,
  maxBatch,
  preparing,
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
      <div className="mb-6 flex justify-center">
        <Tabs value={mode} onValueChange={(v) => onSwitchMode(v as AnalysisMode)}>
          <TabsList aria-label="Analysis mode">
            <TabsTrigger value="photo">
              <Camera className="h-4 w-4" /> Photo
            </TabsTrigger>
            <TabsTrigger value="video">
              <Video className="h-4 w-4" /> Video
            </TabsTrigger>
          </TabsList>
        </Tabs>
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
          "flex flex-col items-center justify-center rounded-lg border-2 border-dashed bg-card px-6 py-14 text-center shadow-card transition-all cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-ring",
          dragging ? "border-primary bg-accent/60" : "border-input hover:border-primary/50 hover:bg-accent/40",
        )}
      >
        <div className="mb-4 grid h-14 w-14 place-items-center rounded-lg bg-accent text-accent-foreground">
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
            : `JPG or PNG${maxBatch ? ` · up to ${maxBatch} photos` : ""}`}
        </p>
        <input
          ref={inputRef}
          type="file"
          accept={isVideoMode ? "video/*,.mp4,.mov,.webm,.m4v" : ".jpg,.jpeg,.png"}
          multiple={!isVideoMode}
          className="hidden"
          onChange={(e) => {
            handleFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {isVideoMode && videoSettings && onVideoSettingsChange && (
        <VideoSettings settings={videoSettings} onChange={onVideoSettingsChange} />
      )}

      {/* Right under the dropzone so it can't scroll out of view below a big grid. */}
      {!isVideoMode && notice && (
        <Alert variant="warning" className="mt-4">
          <AlertDescription className="text-center">{notice}</AlertDescription>
        </Alert>
      )}

      {wrongType && (
        <Alert variant="warning" className="mt-4">
          <AlertDescription className="flex flex-wrap items-center justify-center gap-2">
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
          </AlertDescription>
        </Alert>
      )}

      {!isVideoMode && onUseSample && items.length === 0 && (
        <div className="mt-6 border-t pt-4 text-center">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
            Or test with a sample scenario:
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <SampleButton icon={<Monitor className="h-3.5 w-3.5" />} label="Office Desk Work" onClick={() => onUseSample("office")} />
            <SampleButton icon={<Package className="h-3.5 w-3.5" />} label="Warehouse Lifting" onClick={() => onUseSample("warehouse")} />
            <SampleButton icon={<Wrench className="h-3.5 w-3.5" />} label="Assembly Standing" onClick={() => onUseSample("assembly")} />
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
            <Button size="lg" onClick={onAnalyze} disabled={preparing}>
              {preparing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
              {preparing
                ? "Preparing photos…"
                : `Analyze ${items.length > 1 ? `${items.length} photos` : "photo"}`}
            </Button>
          </div>
        </div>
      )}

      {/* Camera Guidance Expandable Panel */}
      {!isVideoMode && <PhotoGuide />}
    </div>
  );
}

function SampleButton({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-lg border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground shadow-card transition-all hover:border-primary/50 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span className="text-primary">{icon}</span>
      {label}
    </button>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 12 12" className="inline mr-2 h-3.5 w-3.5 shrink-0 text-risk-low" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none">
      <polyline points="3.5 6 5 7.5 8.5 4" />
    </svg>
  );
}

function CrossIcon() {
  return (
    <svg viewBox="0 0 12 12" className="inline mr-2 h-3.5 w-3.5 shrink-0 text-risk-veryhigh" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none">
      <line x1="3.5" y1="3.5" x2="8.5" y2="8.5" />
      <line x1="8.5" y1="3.5" x2="3.5" y2="8.5" />
    </svg>
  );
}

/** Side-profile stick figure used by every guide tile (drawn in primary). */
function GuideFigure({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x}, ${y})`} stroke="hsl(var(--primary))" fill="none" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="0" cy="0" r="6" fill="hsl(var(--primary))" stroke="none" />
      <path d="M 0 6 Q -2 20 0 35" strokeWidth="3.5" />
      <path d="M 0 10 L 5 25 L -2 38" strokeWidth="3" />
      <path d="M 0 35 L -3 60 M 0 35 L 5 60" strokeWidth="3.5" />
    </g>
  );
}

function GuideCamera() {
  return (
    <g stroke="hsl(var(--primary))" strokeWidth="1.5" fill="none">
      <rect x="0" y="0" width="13" height="9" rx="2" />
      <path d="M 13 2.5 L 17 0.5 L 17 8.5 L 13 6.5 Z" fill="hsl(var(--primary))" fillOpacity="0.2" />
    </g>
  );
}

/**
 * Camera guidance panel. Each tile animates the one thing it teaches - the
 * camera orbits to the side view, settles at waist height, the frame widens
 * to take the whole body in. Pure CSS keyframes (see index.css), so the
 * tiles respect prefers-reduced-motion and both themes for free.
 */
function PhotoGuide() {
  const [isOpen, setIsOpen] = useState(true);

  return (
    <div className="mt-8 rounded-lg border bg-card p-5 text-left shadow-card transition-all duration-200">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
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
          {/* Tile 1: orbit around the subject until you see the profile. */}
          <div className="rounded-xl border border-border/50 bg-background/40 p-4 flex flex-col gap-3">
            <h4 className="font-semibold text-xs text-foreground uppercase tracking-wider">1. View Orientation</h4>
            <div className="aspect-[4/3] rounded-lg bg-muted/20 border border-border/40 overflow-hidden relative">
              <svg viewBox="0 0 200 120" className="w-full h-full text-muted-foreground" aria-hidden>
                <ellipse cx="132" cy="62" rx="92" ry="40" fill="none" stroke="currentColor" strokeWidth="1" strokeDasharray="2 5" opacity="0.35" />
                <GuideFigure x={132} y={26} />
                {/* orbit arm: transform-box spans camera -> figure, origin at the figure end */}
                <g className="guide-orbit">
                  <g transform="translate(30, 57)">
                    <GuideCamera />
                    <line x1="20" y1="4.5" x2="92" y2="4.5" stroke="hsl(var(--primary))" strokeWidth="1.5" strokeDasharray="3 3" opacity="0.5" />
                  </g>
                  <rect x="30" y="61" width="102" height="1" fill="none" stroke="none" />
                </g>
                <text x="10" y="112" fill="currentColor" fontSize="8" opacity="0.7">90° = true profile</text>
              </svg>
            </div>
            <ul className="text-xs space-y-1.5 text-muted-foreground font-medium">
              <li className="flex items-start"><CheckIcon /><span className="text-foreground">Side view (90° profile)</span></li>
              <li className="flex items-start"><CrossIcon /><span className="text-foreground">Avoid frontal or diagonal shots</span></li>
            </ul>
          </div>

          {/* Tile 2: the camera settles level with the subject's waist. */}
          <div className="rounded-xl border border-border/50 bg-background/40 p-4 flex flex-col gap-3">
            <h4 className="font-semibold text-xs text-foreground uppercase tracking-wider">2. Camera Height</h4>
            <div className="aspect-[4/3] rounded-lg bg-muted/20 border border-border/40 overflow-hidden relative">
              <svg viewBox="0 0 200 120" className="w-full h-full text-muted-foreground" aria-hidden>
                <GuideFigure x={155} y={26} />
                <line x1="146" y1="52" x2="166" y2="52" stroke="currentColor" strokeWidth="1" opacity="0.4" />
                <line x1="130" y1="90" x2="180" y2="90" stroke="currentColor" strokeWidth="1.5" opacity="0.25" />
                <g className="guide-level">
                  <g transform="translate(24, 47)">
                    <GuideCamera />
                    <line x1="20" y1="4.5" x2="126" y2="4.5" stroke="hsl(var(--primary))" strokeWidth="1.5" strokeDasharray="4 4" opacity="0.7" />
                  </g>
                </g>
                <text x="10" y="112" fill="currentColor" fontSize="8" opacity="0.7">lens level with the waist</text>
              </svg>
            </div>
            <ul className="text-xs space-y-1.5 text-muted-foreground font-medium">
              <li className="flex items-start"><CheckIcon /><span className="text-foreground">Lens at subject&apos;s waist level</span></li>
              <li className="flex items-start"><CrossIcon /><span className="text-foreground">Avoid high overhead/low angles</span></li>
            </ul>
          </div>

          {/* Tile 3: the frame widens until the whole body fits. */}
          <div className="rounded-xl border border-border/50 bg-background/40 p-4 flex flex-col gap-3">
            <h4 className="font-semibold text-xs text-foreground uppercase tracking-wider">3. Full Body Framing</h4>
            <div className="aspect-[4/3] rounded-lg bg-muted/20 border border-border/40 overflow-hidden relative">
              <svg viewBox="0 0 200 120" className="w-full h-full text-muted-foreground" aria-hidden>
                <GuideFigure x={100} y={28} />
                <g className="guide-fade">
                  <line x1="55" y1="88" x2="145" y2="88" stroke="hsl(var(--risk-veryhigh))" strokeWidth="1.5" strokeDasharray="3 3" opacity="0.8" />
                  <text x="100" y="100" textAnchor="middle" fill="hsl(var(--risk-veryhigh))" fontSize="7" fontWeight="600">CROPPED</text>
                </g>
                <g className="guide-frame" stroke="hsl(var(--primary))" strokeWidth="2" fill="none" opacity="0.85">
                  <path d="M 58 22 L 58 12 L 68 12" />
                  <path d="M 132 12 L 142 12 L 142 22" />
                  <path d="M 58 98 L 58 108 L 68 108" />
                  <path d="M 132 108 L 142 108 L 142 98" />
                </g>
              </svg>
            </div>
            <ul className="text-xs space-y-1.5 text-muted-foreground font-medium">
              <li className="flex items-start"><CheckIcon /><span className="text-foreground">Entire body in frame (head to toe)</span></li>
              <li className="flex items-start"><CrossIcon /><span className="text-foreground">Avoid cropped limbs or hands</span></li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
