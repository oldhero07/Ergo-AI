import { Suspense, lazy, useEffect, useRef, useState } from "react";

// three.js + R3F live in their own lazy chunk: nothing 3D is downloaded until
// the hero slot is actually near-visible and the browser is idle.
const HeroScene = lazy(() => import("@/three/HeroScene"));

/**
 * On-demand decorative 3D hero scene. Mounts only once the browser is idle
 * AND the slot is in/near the viewport, so it never competes with the
 * initial page load. Renders nothing until then - the static SVG placeholder
 * in Landing.tsx stays visible the whole time, and `onReady` is only called
 * once the WebGL canvas has actually mounted, so the caller can swap it in.
 */
export function HeroSceneLazy({ onReady }: { onReady?: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [canMount, setCanMount] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    let idle = false;
    let visible = false;
    let idleHandle: number | undefined;
    let timeoutHandle: ReturnType<typeof setTimeout> | undefined;

    const tryMount = () => {
      if (idle && visible) setCanMount(true);
    };

    const markIdle = () => {
      idle = true;
      tryMount();
    };

    const ric: typeof window.requestIdleCallback | undefined = window.requestIdleCallback;
    if (ric) {
      idleHandle = ric(markIdle, { timeout: 2000 });
    } else {
      timeoutHandle = setTimeout(markIdle, 2000);
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            visible = true;
            tryMount();
          }
        }
      },
      { rootMargin: "200px" },
    );
    observer.observe(el);

    return () => {
      observer.disconnect();
      if (idleHandle !== undefined && window.cancelIdleCallback) window.cancelIdleCallback(idleHandle);
      if (timeoutHandle !== undefined) clearTimeout(timeoutHandle);
    };
  }, []);

  return (
    <div ref={ref} className="h-full w-full">
      {canMount && (
        <Suspense fallback={null}>
          <HeroScene onReady={onReady} />
        </Suspense>
      )}
    </div>
  );
}
