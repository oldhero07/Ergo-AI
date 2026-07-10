import { History, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { SessionSnapshot } from "@/lib/sessionStore";

/** Crash/refresh recovery offer - protects the scored session, the most
 * valuable thing in the app. Shown until restored, dismissed, or replaced. */
export function SessionRestoreBanner({
  snapshot,
  onRestore,
  onDismiss,
}: {
  snapshot: SessionSnapshot;
  onRestore: () => void;
  onDismiss: () => void;
}) {
  return (
    <div className="mx-auto mb-6 flex max-w-3xl items-center justify-between gap-3 rounded-lg border bg-card px-4 py-3 shadow-card">
      <div className="flex items-center gap-2.5 text-sm">
        <History className="h-4 w-4 shrink-0 text-primary" />
        <span>
          Restore your last session? {snapshot.items.length} photo
          {snapshot.items.length > 1 ? "s" : ""} scored {new Date(snapshot.savedAt).toLocaleString()}.
        </span>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        <Button size="sm" onClick={onRestore}>
          Restore
        </Button>
        <Button size="sm" variant="ghost" aria-label="Dismiss restore" onClick={onDismiss}>
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
