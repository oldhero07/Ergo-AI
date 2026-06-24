import { useCallback, useEffect, useRef, useState } from "react";
import { Upload, X, Images, Play, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { UploadItem } from "@/types";

/**
 * Thumbnail tile. Chrome/Firefox can't render an iPhone HEIC in an <img>, so the
 * raw object URL fails to load — but the file IS attached and will be converted
 * (heic2any) at analysis time. Rather than show a broken-image glyph (which reads
 * as "upload failed"), fall back to a labelled placeholder so it's clear the
 * photo is queued and will be analyzed.
 */
function Thumb({ url, name }: { url: string; name: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-1 p-2 text-center">
        <Images className="h-5 w-5 text-muted-foreground" />
        <span className="line-clamp-2 break-all text-[10px] leading-tight text-muted-foreground">{name}</span>
        <span className="text-[9px] text-muted-foreground/70">queued · preview not supported</span>
      </div>
    );
  }
  return (
    <img src={url} alt={name} onError={() => setFailed(true)} className="h-full w-full object-cover" />
  );
}

interface UploaderProps {
  items: UploadItem[];
  onAddFiles: (files: File[]) => void;
  onRemove: (id: string) => void;
  onClear: () => void;
  onAnalyze: () => void;
  onUseSample?: () => void;
}

export function Uploader({
  items,
  onAddFiles,
  onRemove,
  onClear,
  onAnalyze,
  onUseSample,
}: UploaderProps) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback(
    (list: FileList | null) => {
      if (!list) return;
      onAddFiles(Array.from(list));
    },
    [onAddFiles],
  );

  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const files = e.clipboardData?.files;
      if (files && files.length) {
        onAddFiles(Array.from(files)); // addFiles filters to images (incl. HEIC)
      }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [onAddFiles]);

  return (
    <div className="mx-auto w-full max-w-3xl">
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
          "flex flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-14 text-center transition-colors cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-ring",
          dragging ? "border-primary bg-accent" : "border-border hover:border-primary/50 hover:bg-accent/40",
        )}
      >
        <div className="mb-4 grid h-14 w-14 place-items-center rounded-full bg-secondary">
          <Upload className="h-6 w-6 text-muted-foreground" />
        </div>
        <p className="text-base font-medium">Drag &amp; drop photos here</p>
        <p className="mt-1 text-sm text-muted-foreground">
          or click to browse · paste from clipboard · one or many
        </p>
        <p className="mt-3 text-xs text-muted-foreground">JPG, PNG, or iPhone HEIC</p>
        <input
          ref={inputRef}
          type="file"
          accept="image/*,.heic,.heif"
          multiple
          className="hidden"
          onChange={(e) => {
            handleFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {onUseSample && items.length === 0 && (
        <div className="mt-3 text-center">
          <Button variant="link" size="sm" onClick={onUseSample} className="text-muted-foreground">
            or use a sample photo
          </Button>
        </div>
      )}

      {items.length > 0 && (
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
              <div
                key={it.id}
                className="group relative aspect-square overflow-hidden rounded-lg border bg-muted"
              >
                <Thumb url={it.url} name={it.file.name} />
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
