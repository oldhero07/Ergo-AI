import { useCallback, useEffect, useRef, useState } from "react";
import { Upload, X, Images, Play, Trash2, Loader2, Camera, ChevronDown, Video, ArrowRight, Monitor, Package, Wrench } from "lucide-react";
import { CAPTURE_RULES } from "@/lib/captureRules";
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

function PhotoGuide() {
  const [isOpen, setIsOpen] = useState(true);
  const [videoOk, setVideoOk] = useState(true);
  const [wantsVideo] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: no-preference)").matches,
  );
  const videoRef = useRef<HTMLVideoElement>(null);
  const base = import.meta.env.BASE_URL;

  // The video remounts each time the panel expands; autoplay isn't guaranteed
  // then, so nudge playback and fall back to the poster if it's refused.
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !wantsVideo || !isOpen) return;
    video.play().catch(() => setVideoOk(false));
  }, [wantsVideo, isOpen]);

  return (
    <section className="mt-8 overflow-hidden rounded-xl border bg-card text-left shadow-card">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        className="flex w-full items-center justify-between gap-3 px-5 py-4 text-sm font-semibold text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span className="flex items-center gap-2">
          <Camera className="h-4 w-4 text-primary" aria-hidden />
          How to shoot for an accurate score
        </span>
        <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", isOpen && "rotate-180")} aria-hidden />
      </button>

      {isOpen && (
        <div className="grid gap-5 border-t p-5 sm:grid-cols-[0.9fr_1.1fr] sm:items-center">
          <figure className="relative overflow-hidden">
            {wantsVideo && videoOk ? (
              <video
                ref={videoRef}
                className="aspect-video w-full mix-blend-multiply [mask-image:radial-gradient(ellipse_70%_80%_at_50%_50%,black_55%,transparent_96%)]"
                src={`${base}hero/v1-loop.mp4`}
                poster={`${base}hero/v1-poster.jpg`}
                muted
                loop
                playsInline
                autoPlay
                preload="metadata"
                aria-hidden
                onError={() => setVideoOk(false)}
              />
            ) : (
              <img src={`${base}hero/v1-poster.jpg`} alt="" width={1280} height={720} className="aspect-video w-full mix-blend-multiply [mask-image:radial-gradient(ellipse_70%_80%_at_50%_50%,black_55%,transparent_96%)]" loading="lazy" />
            )}
            <figcaption className="absolute bottom-2 right-2 rounded-md border bg-card/90 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground backdrop-blur-sm">
              90° side profile
            </figcaption>
          </figure>
          <ul className="space-y-3.5">
            {CAPTURE_RULES.map(({ icon: Icon, name, short }) => (
              <li key={name} className="flex items-start gap-3">
                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <Icon className="h-3.5 w-3.5" aria-hidden />
                </span>
                <div>
                  <p className="text-sm font-medium leading-tight text-foreground">{name}</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{short}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
