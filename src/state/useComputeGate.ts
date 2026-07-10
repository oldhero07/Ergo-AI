import { useCallback, useRef, useState } from "react";
import { COMPUTE_LOOP_MS } from "@/hooks/useComputeTimeline";

/**
 * Single owner of the compute-screen timing contract, shared by the photo and
 * video flows:
 *  - MIN_COMPUTE_MS: floor so the compute animation always gets a full cycle
 *    on screen, even when detection resolves near-instantly. Derived from the
 *    real GSAP timeline duration so it can't drift out of sync with it.
 *  - makeFloor(): the awaitable floor promise for one run.
 *  - skipAnimation(): user skip - drops the decorative floor and the animation
 *    itself (falls back to a plain spinner); it can't skip real work in flight.
 */
export function useComputeGate() {
  const [showAnimation, setShowAnimation] = useState(true);
  const skipResolveRef = useRef<(() => void) | null>(null);

  const MIN_COMPUTE_MS = Math.max(4500, COMPUTE_LOOP_MS);

  const makeFloor = useCallback(
    (startedAt: number) =>
      new Promise<void>((resolve) => {
        const remaining = MIN_COMPUTE_MS - (performance.now() - startedAt);
        const timer = setTimeout(resolve, Math.max(0, remaining));
        skipResolveRef.current = () => {
          clearTimeout(timer);
          resolve();
        };
      }),
    [MIN_COMPUTE_MS],
  );

  /** Clear the skip hook once a run's floor has been awaited. */
  const releaseFloor = useCallback(() => {
    skipResolveRef.current = null;
  }, []);

  /** Resolve a pending floor immediately (used by cancel paths). */
  const skipFloor = useCallback(() => {
    skipResolveRef.current?.();
  }, []);

  const skipAnimation = useCallback(() => {
    setShowAnimation(false);
    skipResolveRef.current?.();
  }, []);

  /** Re-arm the animation for the next run (reset/start-over). */
  const resetAnimation = useCallback(() => {
    setShowAnimation(true);
  }, []);

  return { MIN_COMPUTE_MS, showAnimation, makeFloor, releaseFloor, skipFloor, skipAnimation, resetAnimation };
}

export type ComputeGate = ReturnType<typeof useComputeGate>;
