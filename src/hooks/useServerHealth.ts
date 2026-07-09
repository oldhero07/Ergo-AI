import { useCallback, useEffect, useRef, useState } from "react";
import { apiHealth } from "@/lib/poseClient";

export type ServerHealth = "checking" | "warming" | "ready" | "unreachable";

/** How long to keep fast-polling a waking server before calling it unreachable. */
const WARMING_BUDGET_MS = 4 * 60 * 1000;
const POLL_MS = 5000;
/** After "unreachable", keep probing slowly so recovery is automatic. */
const SLOW_POLL_MS = 30000;

/**
 * Wakes the inference server and tracks its state for the UI:
 * checking (first probe) -> ready, or -> warming (cold start; can take a
 * couple of minutes on a scale-to-zero host) -> ready | unreachable.
 *
 * Purely informational - analysis requests are never gated on this. A cold
 * host holds the first request until it's up, so analyzing while "warming"
 * still succeeds; the banner just explains the wait instead of a bare spinner.
 */
export function useServerHealth(): { health: ServerHealth; retry: () => void } {
  const [health, setHealth] = useState<ServerHealth>("checking");
  const [attempt, setAttempt] = useState(0);
  const startedAt = useRef(Date.now());

  const retry = useCallback(() => {
    startedAt.current = Date.now();
    setHealth("checking");
    setAttempt((n) => n + 1);
  }, []);

  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const probe = async () => {
      const ok = await apiHealth();
      if (!alive) return;
      if (ok) {
        setHealth("ready");
        return;
      }
      const elapsed = Date.now() - startedAt.current;
      if (elapsed < WARMING_BUDGET_MS) {
        setHealth("warming");
        timer = setTimeout(probe, POLL_MS);
      } else {
        setHealth("unreachable");
        timer = setTimeout(probe, SLOW_POLL_MS);
      }
    };

    void probe();
    return () => {
      alive = false;
      if (timer !== undefined) clearTimeout(timer);
    };
  }, [attempt]);

  return { health, retry };
}
