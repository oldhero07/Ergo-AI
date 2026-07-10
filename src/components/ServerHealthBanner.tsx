import { Loader2, WifiOff } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import type { useServerHealth } from "@/hooks/useServerHealth";

type Health = ReturnType<typeof useServerHealth>["health"];

/**
 * Cold-start honesty: the inference server scales to zero, so a first visit
 * can take minutes. Saying so plainly (instead of looking broken) is what
 * keeps users from abandoning - don't remove these states.
 */
export function ServerHealthBanner({ health, onRetry }: { health: Health; onRetry: () => void }) {
  if (health === "warming") {
    return (
      <Alert variant="info" className="mx-auto mt-4 max-w-3xl">
        <Loader2 className="animate-spin" />
        <AlertDescription>
          Waking the analysis engine - a first visit can take a couple of minutes. You can queue
          photos meanwhile.
        </AlertDescription>
      </Alert>
    );
  }
  if (health === "unreachable") {
    return (
      <Alert variant="warning" className="mx-auto mt-4 max-w-3xl">
        <WifiOff />
        <AlertDescription className="flex flex-wrap items-center justify-between gap-2">
          <span>The analysis server can't be reached - check your connection.</span>
          <Button size="sm" variant="outline" onClick={onRetry}>
            Retry
          </Button>
        </AlertDescription>
      </Alert>
    );
  }
  return null;
}
