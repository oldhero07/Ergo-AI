import { Loader2, RotateCcw } from "lucide-react";
import { AppStateProvider, useAppState } from "@/state/AppStateContext";
import { AppNav } from "@/components/AppNav";
import { AppFooter } from "@/components/AppFooter";
import { SessionRestoreBanner } from "@/components/SessionRestoreBanner";
import { ServerHealthBanner } from "@/components/ServerHealthBanner";
import { Landing } from "@/components/Landing";
import { Uploader } from "@/components/Uploader";
import { ComputeAnimation } from "@/components/ComputeAnimation";
import { VideoResults } from "@/components/VideoResults";
import { NioshCalculator } from "@/components/NioshCalculator";
import { ReportDetails } from "@/components/ReportDetails";
import { PhotoResultsScreen } from "@/screens/PhotoResultsScreen";
import { PhaseTransition } from "@/components/PhaseTransition";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { MAX_BATCH } from "@/state/usePhotoSession";

export default function App() {
  return (
    <AppStateProvider>
      <AppShell />
    </AppStateProvider>
  );
}

function AppShell() {
  const app = useAppState();
  const { route, navigate, stage, photo, video } = app;

  // Defensive stage resolution: a stale in-memory stage (e.g. "video" after
  // the clip was cleared) falls back to the uploader instead of a blank view.
  const effectiveStage =
    stage === "results" && !photo.hasResults
      ? "idle"
      : stage === "video" && !(video.videoUrl && video.analysis)
        ? "idle"
        : stage;

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <AppNav route={route} onNavigate={navigate} />

      <main className="container flex-1 py-10">
        <PhaseTransition phaseKey={route === "analyze" ? `analyze:${effectiveStage}` : route}>
          {route === "home" && <HomeView />}
          {route === "niosh" && (
            <NioshCalculator
              onBack={() => navigate(photo.hasResults ? "analyze" : "home")}
              reportMeta={app.reportMeta}
            />
          )}
          {route === "analyze" && effectiveStage === "idle" && <AnalyzeIdleView />}
          {route === "analyze" && effectiveStage === "computing" && <ComputingView />}
          {route === "analyze" && effectiveStage === "results" && <PhotoResultsScreen />}
          {route === "analyze" && effectiveStage === "video" && <VideoResultsView />}
        </PhaseTransition>
      </main>

      <AppFooter route={route} />
    </div>
  );
}

function HomeView() {
  const { photo, startAnalyzing, navigate } = useAppState();
  return (
    <>
      {photo.restorable && !photo.hasResults && (
        <SessionRestoreBanner
          snapshot={photo.restorable}
          onRestore={() => {
            photo.restoreSession(photo.restorable!);
            navigate("analyze");
          }}
          onDismiss={photo.dismissRestore}
        />
      )}
      <Landing onStart={startAnalyzing} />
      <p className="mt-8 text-center text-sm text-muted-foreground">
        Manual lifting task instead?{" "}
        <button
          type="button"
          onClick={() => navigate("niosh")}
          className="font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Open the NIOSH lifting calculator →
        </button>
      </p>
    </>
  );
}

function AnalyzeIdleView() {
  const { photo, video, mode, switchAnalysisMode, serverHealth, retryServer, navigate } = useAppState();
  return (
    <div>
      {photo.restorable && !photo.hasResults && (
        <SessionRestoreBanner
          snapshot={photo.restorable}
          onRestore={() => {
            photo.restoreSession(photo.restorable!);
            navigate("analyze");
          }}
          onDismiss={photo.dismissRestore}
        />
      )}
      <Uploader
        mode={mode}
        onSwitchMode={switchAnalysisMode}
        items={photo.items}
        onAddFiles={photo.addFiles}
        onVideo={video.runVideoAnalysis}
        onRemove={photo.removeItem}
        onClear={photo.clearItems}
        onAnalyze={() => void photo.runAnalysis()}
        onUseSample={(k) => void photo.useSample(k)}
        videoSettings={video.settings}
        onVideoSettingsChange={video.setSettings}
        notice={photo.notice}
        maxBatch={MAX_BATCH}
        preparing={photo.preparing}
      />
      {video.error && (
        <Alert variant="destructive" className="mx-auto mt-4 max-w-3xl">
          <AlertDescription>Could not analyze the video: {video.error}</AlertDescription>
        </Alert>
      )}
      <ServerHealthBanner health={serverHealth} onRetry={retryServer} />
      <p className="mx-auto mt-6 max-w-lg text-center text-sm text-muted-foreground">
        {mode === "video"
          ? "Tip: a short, steady side-view clip of the working posture reads best."
          : "Tip: a clear, full-body side view of the working posture reads best."}
      </p>
    </div>
  );
}

function ComputingView() {
  const { gate, mode, serverHealth, photo, video } = useAppState();
  const note =
    serverHealth === "warming"
      ? "Waking the analysis server - a first visit can take a couple of minutes. Your photos are queued and will be scored as soon as it's up."
      : video.progress !== null
        ? `Analyzing video - ${video.progress}% (sampling frames)`
        : photo.photoProgress && photo.photoProgress.total > 1
          ? `Analyzing photo ${Math.min(photo.photoProgress.done + 1, photo.photoProgress.total)} of ${photo.photoProgress.total}`
          : undefined;

  return (
    <div>
      {gate.showAnimation ? (
        <ComputeAnimation note={note} onSkip={mode === "video" ? undefined : gate.skipAnimation} />
      ) : (
        <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">
            {serverHealth === "warming"
              ? "Waking the analysis server - this can take a couple of minutes on a first visit…"
              : video.progress !== null
                ? `Analyzing video - ${video.progress}%`
                : photo.photoProgress && photo.photoProgress.total > 1
                  ? `Analyzing photo ${Math.min(photo.photoProgress.done + 1, photo.photoProgress.total)} of ${photo.photoProgress.total}`
                  : "Still working…"}
          </p>
        </div>
      )}
      {video.progress !== null && (
        <div className="mt-6 flex justify-center">
          <Button variant="outline" onClick={video.cancelVideoAnalysis}>
            Cancel
          </Button>
        </div>
      )}
    </div>
  );
}

function VideoResultsView() {
  const { video, methodId, photo, reportMeta, setReportMeta, reset } = useAppState();
  if (!video.videoUrl || !video.analysis) return null;
  return (
    <div>
      <div className="mx-auto mb-4 flex w-full max-w-4xl justify-end">
        <Button variant="outline" onClick={reset}>
          <RotateCcw className="h-4 w-4" /> Start over
        </Button>
      </div>
      <div className="mx-auto w-full max-w-4xl">
        <ReportDetails meta={reportMeta} onChange={setReportMeta} />
      </div>
      <VideoResults
        videoUrl={video.videoUrl}
        fileName={video.videoName}
        analysis={video.analysis}
        methodId={methodId}
        onMethodChange={photo.switchMethod}
        reportMeta={reportMeta}
      />
    </div>
  );
}
