import { Activity, Weight } from "lucide-react";
import { Logo } from "@/components/Logo";
import { cn } from "@/lib/utils";
import type { Route } from "@/hooks/useHashRoute";

const LINKS: { route: Route; label: string; icon: typeof Activity }[] = [
  { route: "analyze", label: "Analyze", icon: Activity },
  { route: "niosh", label: "NIOSH Lifting", icon: Weight },
];

/**
 * Persistent top navigation: the user can always see where they are and move
 * between the three destinations. Navigating never destroys the session -
 * only the explicit "Start over" in the results view does.
 */
export function AppNav({ route, onNavigate }: { route: Route; onNavigate: (r: Route) => void }) {
  return (
    <header className="sticky top-0 z-20 border-b bg-background">
      <div className="container flex items-center justify-between gap-3 py-3">
        <button
          type="button"
          onClick={() => onNavigate("home")}
          className="flex items-center gap-2.5 rounded-lg text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Ergo AI - home"
          aria-current={route === "home" ? "page" : undefined}
        >
          <Logo className="h-9 w-9 shrink-0" />
          <div className="min-w-0">
            <span className="block text-lg font-semibold leading-none tracking-tight">Ergo AI</span>
            <span className="hidden text-xs text-muted-foreground sm:block">
              Ergonomic risk assessment
            </span>
          </div>
        </button>

        <nav aria-label="Primary" className="flex items-center gap-1">
          {LINKS.map(({ route: r, label, icon: Icon }) => {
            const active = route === r;
            return (
              <button
                key={r}
                type="button"
                onClick={() => onNavigate(r)}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex h-10 items-center gap-1.5 rounded-md px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  active ? "text-primary" : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                )}
              >
                <Icon className="h-4 w-4 shrink-0" aria-hidden />
                <span className="hidden sm:inline">{label}</span>
                <span className="sm:hidden">{label.split(" ")[0]}</span>
                {active && (
                  <span aria-hidden className="absolute inset-x-2 -bottom-[13px] h-0.5 rounded-full bg-primary" />
                )}
              </button>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
