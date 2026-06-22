import { useCallback, useState } from "react";
import { Loader2, RotateCcw, ScanLine, AlertTriangle } from "lucide-react";
import { Uploader } from "@/components/Uploader";
import { Scorecard } from "@/components/Scorecard";
import { Button } from "@/components/ui/button";
import { analyzePhoto, type PoseAnalysis } from "@/lib/analyze";
import type { UploadItem } from "@/types";

type Phase = "idle" | "computing" | "results";
type ResultMap = Record<string, PoseAnalysis>;

export default function App() {
  const [items, setItems] = useState<UploadItem[]>([]);
  const [phase, setPhase] = useState<Phase>("idle");
  const [results, setResults] = useState<ResultMap>({});

  const addFiles = useCallback((files: File[]) => {
    const imgs = files.filter((f) => f.type.startsWith("image/"));
    if (!imgs.length) return;
    setItems((prev) => [
      ...prev,
      ...imgs.map((f) => ({ id: crypto.randomUUID(), file: f, url: URL.createObjectURL(f) })),
    ]);
  }, []);

  const removeItem = useCallback((id: string) => {
    setItems((prev) => {
      const it = prev.find((p) => p.id === id);
      if (it) URL.revokeObjectURL(it.url);
      return prev.filter((p) => p.id !== id);
    });
  }, []);

  const clearItems = useCallback(() => {
    setItems((prev) => {
      prev.forEach((p) => URL.revokeObjectURL(p.url));
      return [];
    });
  }, []);

  const useSample = useCallback(async () => {
    try {
      const res = await fetch(`${import.meta.env.BASE_URL}samples/weaver-sample.jpg`);
      if (!res.ok) return;
      const blob = await res.blob();
      addFiles([new File([blob], "weaver-sample.jpg", { type: blob.type || "image/jpeg" })]);
    } catch {
      /* sample not bundled — ignore */
    }
  }, [addFiles]);

  const runAnalysis = useCallback(async () => {
    setPhase("computing");
    const out: ResultMap = {};
    for (const it of items) {
      try {
        out[it.id] = await analyzePhoto(it.file);
      } catch (e) {
        out[it.id] = {
          skeletonUrl: it.url,
          landmarks: [],
          worldLandmarks: [],
          width: 0,
          height: 0,
          detected: false,
          error: (e as Error).message,
        };
      }
    }
    setResults(out);
    setPhase("results");
  }, [items]);

  const reset = () => setPhase("idle");

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b">
        <div className="container flex items-center gap-2.5 py-4">
          <div className="grid h-8 w-8 place-items-center rounded-md bg-primary text-primary-foreground">
            <ScanLine className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-lg font-semibold leading-none tracking-tight">Ergo AI</h1>
            <p className="text-xs text-muted-foreground">RULA ergonomic risk from a photo</p>
          </div>
        </div>
      </header>

      <main className="container py-10">
        {phase === "idle" && (
          <Uploader
            items={items}
            onAddFiles={addFiles}
            onRemove={removeItem}
            onClear={clearItems}
            onAnalyze={runAnalysis}
            onUseSample={useSample}
          />
        )}

        {phase === "computing" && (
          <div className="flex min-h-[50vh] flex-col items-center justify-center text-center">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <p className="mt-4 text-lg font-medium">Analyzing posture…</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Detecting pose · computing vectors · solving angles · running RULA
            </p>
            <p className="mt-3 text-xs text-muted-foreground">
              First run loads the Pose Heavy model (~30 MB) — a moment, then it’s cached.
            </p>
          </div>
        )}

        {phase === "results" && (
          <div className="mx-auto w-full max-w-4xl">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-xl font-semibold">Results</h2>
              <Button variant="outline" onClick={reset}>
                <RotateCcw className="h-4 w-4" /> Analyze more
              </Button>
            </div>
            <div className="space-y-8">
              {items.map((it) => {
                const r = results[it.id];
                return (
                  <div key={it.id} className="overflow-hidden rounded-xl border">
                    <div className="grid sm:grid-cols-2">
                      <figure className="border-b sm:border-b-0 sm:border-r">
                        <img src={it.url} alt="original" className="aspect-[4/3] w-full bg-muted object-contain" />
                        <figcaption className="truncate px-4 py-2 text-xs text-muted-foreground">
                          Original · {it.file.name}
                        </figcaption>
                      </figure>
                      <figure>
                        <img
                          src={r?.skeletonUrl ?? it.url}
                          alt="skeleton"
                          className="aspect-[4/3] w-full bg-muted object-contain"
                        />
                        <figcaption className="px-4 py-2 text-xs text-muted-foreground">
                          MediaPipe skeleton
                        </figcaption>
                      </figure>
                    </div>
                    {r?.error ? (
                      <div className="flex items-center gap-2 border-t px-5 py-4 text-sm text-destructive">
                        <AlertTriangle className="h-4 w-4" /> Could not analyze: {r.error}
                      </div>
                    ) : r?.assessment ? (
                      <div className="border-t">
                        <Scorecard result={r.assessment} />
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 border-t px-5 py-4 text-sm text-amber-600">
                        <AlertTriangle className="h-4 w-4" /> No pose detected — try a clearer, full-body side view.
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
