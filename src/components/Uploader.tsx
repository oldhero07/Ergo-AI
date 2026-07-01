import { useCallback, useEffect, useRef, useState } from "react";
import { Upload, X, Images, Play, Trash2, Loader2, Camera, Video, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { isVideoFile } from "@/lib/videoFile";
import { MAX_VIDEO_MB, MAX_DURATION_SEC } from "@/lib/videoConfig";
import type { AnalysisMode, UploadItem } from "@/types";

/**
 * Thumbnail tile. Chrome/Firefox can't render an iPhone HEIC in an <img>, so the
 * raw object URL fails to load — but the file IS attached and will be decoded
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
  onUseSample?: () => void;
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
      <div role="tablist" aria-label="Analysis mode" className="mx-auto mb-6 inline-flex rounded-xl border bg-card p-1 shadow-sm">
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
          "flex flex-col items-center justify-center rounded-3xl border-2 border-dashed px-6 py-14 text-center transition-colors cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-ring",
          dragging ? "border-primary bg-primary/5" : "border-border bg-card/50 hover:border-primary/50 hover:bg-accent/40",
        )}
      >
        <div className="mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-primary/10 text-primary">
          {isVideoMode ? <Video className="h-6 w-6" /> : <Upload className="h-6 w-6" />}
        </div>
        <p className="text-base font-medium">
          {isVideoMode ? "Drag & drop a video here" : "Drag & drop photos here"}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          {isVideoMode ? "or click to browse — one short clip" : "or click to browse · paste from clipboard · one or many"}
        </p>
        <p className="mt-3 text-xs text-muted-foreground">
          {isVideoMode
            ? `MP4, MOV, or WebM · up to ${MAX_VIDEO_MB} MB · first ${MAX_DURATION_SEC}s analyzed`
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
        <div className="mt-3 text-center">
          <Button variant="link" size="sm" onClick={onUseSample} className="text-muted-foreground">
            or use a sample photo
          </Button>
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
              <div key={it.id} className="group relative aspect-square overflow-hidden rounded-xl border bg-muted">
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
        "inline-flex items-center gap-2 rounded-lg px-4 py-1.5 text-sm font-medium transition-colors",
        active ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
      )}
    >
      {icon}
      {label}
    </button>
  );
}
