import { Suspense, lazy, useState } from "react";
import { Box, Loader2 } from "lucide-react";
import type { Landmark } from "@mediapipe/tasks-vision";
import type { AssessmentResult } from "@/assessment/types";
import type { AngleSet } from "@/lib/angles";

// three.js + R3F live in their own lazy chunk: nothing 3D is downloaded until
// the user actually opens a viewer.
const PoseViewer3D = lazy(() => import("@/three/PoseViewer3D"));

/** On-demand "View in 3D" expander for a scored photo's world landmarks. */
export function PoseViewerLazy({
  worldLandmarks,
  result,
  angles,
}: {
  worldLandmarks: Landmark[];
  result: AssessmentResult;
  angles?: AngleSet;
}) {
  const [open, setOpen] = useState(false);
  if (!worldLandmarks?.length) return null;

  return (
    <div className="border-t border-border px-5 py-4">
      {open ? (
        <Suspense
          fallback={
            <div className="flex h-[380px] w-full items-center justify-center rounded-xl border bg-background/60">
              <span className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin text-primary" /> Loading 3D viewer…
              </span>
            </div>
          }
        >
          <PoseViewer3D worldLandmarks={worldLandmarks} result={result} angles={angles} />
        </Suspense>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="glass flex w-full items-center justify-center gap-2.5 rounded-xl px-4 py-3 text-sm font-medium transition-all hover:shadow-glow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Box className="h-4 w-4 text-primary" />
          View detected pose in 3D
          <span className="hud-readout rounded-full bg-primary/10 px-2 py-0.5 text-[10px] text-primary">
            interactive
          </span>
        </button>
      )}
    </div>
  );
}
