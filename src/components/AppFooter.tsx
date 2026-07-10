import type { Route } from "@/hooks/useHashRoute";

export function AppFooter({ route }: { route: Route }) {
  return (
    <footer className="border-t">
      <div className="container flex flex-col items-center gap-1 py-6 text-center text-xs text-muted-foreground">
        <p>
          Photos are analyzed in memory on our inference server and immediately discarded - never
          stored, never used for training. Scores, reports and adjustments stay in your browser.
        </p>
        {route !== "home" && (
          <p>
            RULA and REBA scores are a lower-bound estimate from a single camera view, not a substitute
            for a trained assessor.
          </p>
        )}
      </div>
    </footer>
  );
}
