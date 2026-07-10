import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useHashRoute, type Route } from "@/hooks/useHashRoute";
import { useServerHealth } from "@/hooks/useServerHealth";
import { getPipeline } from "@/lib/pipeline";
import { useComputeGate, type ComputeGate } from "@/state/useComputeGate";
import { usePhotoSession, type PhotoSession } from "@/state/usePhotoSession";
import { useVideoSession, type VideoSession } from "@/state/useVideoSession";
import { useExports, type Exports } from "@/state/useExports";
import type { ReportMetaValues } from "@/components/ReportDetails";
import type { AnalysisMode } from "@/types";

/**
 * In-memory stages of the Analyze route. Not URL-addressable: a fresh page
 * load can never land on computing/results/video because they depend on
 * session state the browser doesn't have.
 */
export type AnalyzeStage = "idle" | "computing" | "results" | "video";

export interface AppState {
  route: Route;
  navigate: (r: Route) => void;
  stage: AnalyzeStage;
  mode: AnalysisMode;
  methodId: string;
  reportMeta: ReportMetaValues;
  setReportMeta: (m: ReportMetaValues) => void;
  serverHealth: ReturnType<typeof useServerHealth>["health"];
  retryServer: () => void;
  gate: ComputeGate;
  photo: PhotoSession;
  video: VideoSession;
  exports: Exports;
  /** Landing CTA: pick a mode and enter the Analyze flow. */
  startAnalyzing: (mode: AnalysisMode) => void;
  /** Swap photo/video entry flows; clears the other flow so they never bleed. */
  switchAnalysisMode: (m: AnalysisMode) => void;
  /** Explicit destructive reset ("Start over"): full teardown to a clean slate. */
  reset: () => void;
}

const AppStateCtx = createContext<AppState | null>(null);

export function useAppState(): AppState {
  const ctx = useContext(AppStateCtx);
  if (!ctx) throw new Error("useAppState must be used within <AppStateProvider>");
  return ctx;
}

export function AppStateProvider({ children }: { children: ReactNode }) {
  const { route, navigate } = useHashRoute();
  // Navigation preserves the session (the scored batch is the most valuable
  // thing in the app - leaving a page must never destroy it). Only the
  // explicit "Start over" tears it down.
  const [stage, setStage] = useState<AnalyzeStage>("idle");
  const [mode, setMode] = useState<AnalysisMode>("photo");
  const [methodId, setMethodId] = useState<string>("rula");
  const [reportMeta, setReportMeta] = useState<ReportMetaValues>({
    assessor: "",
    organization: "",
    subject: "",
  });

  // Wakes the inference server on load and drives the warming/unreachable
  // banner. Informational only - analysis is never gated on it (a cold host
  // holds the first request until it's up).
  const { health: serverHealth, retry: retryServer } = useServerHealth();

  const gate = useComputeGate();
  const photo = usePhotoSession({ gate, stage, setStage, methodId, setMethodId, setMode });
  const video = useVideoSession({ gate, setStage });
  const exports = useExports({
    items: photo.items,
    results: photo.results,
    excludedIds: photo.excludedIds,
    methodId,
    reportMeta,
  });

  // Nudge the inference server awake the moment the user reaches the Analyze
  // route, so the first Analyze click doesn't also pay the cold start.
  const warmedRef = useRef(false);
  useEffect(() => {
    if (route !== "analyze" || warmedRef.current) return;
    warmedRef.current = true;
    void getPipeline().warmUp();
  }, [route]);

  const startAnalyzing = useCallback(
    (m: AnalysisMode) => {
      setMode(m);
      navigate("analyze");
    },
    [navigate],
  );

  const switchAnalysisMode = useCallback(
    (m: AnalysisMode) => {
      setMode(m);
      video.clearError();
      photo.clearItems();
      video.clearVideo();
    },
    [photo, video],
  );

  const reset = useCallback(() => {
    photo.clearPhotoSession();
    video.clearVideo();
    exports.clearExportState();
    gate.resetAnimation();
    setStage("idle");
    navigate("analyze");
  }, [photo, video, exports, gate, navigate]);

  const value: AppState = {
    route,
    navigate,
    stage,
    mode,
    methodId,
    reportMeta,
    setReportMeta,
    serverHealth,
    retryServer,
    gate,
    photo,
    video,
    exports,
    startAnalyzing,
    switchAnalysisMode,
    reset,
  };

  return <AppStateCtx.Provider value={value}>{children}</AppStateCtx.Provider>;
}
