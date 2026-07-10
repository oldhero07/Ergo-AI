import { useCallback, useEffect, useState } from "react";

/**
 * Top-level destinations. Only these are URL-addressable: the analyze flow's
 * computing/results/video stages depend on in-memory state a fresh page load
 * cannot have, so they stay sub-states of "#/analyze" (see AppStateContext).
 *
 * A hash router (not history API) because the app deploys under three bases
 * (Vercel root, GitHub Pages subpath, custom domain) with `base: "./"`.
 */
export type Route = "home" | "analyze" | "niosh";

function parseHash(): Route {
  const h = window.location.hash.replace(/^#\/?/, "").replace(/\/+$/, "").toLowerCase();
  if (h === "analyze") return "analyze";
  if (h === "niosh") return "niosh";
  return "home";
}

export function useHashRoute() {
  const [route, setRoute] = useState<Route>(parseHash);

  useEffect(() => {
    const onHash = () => setRoute(parseHash());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const navigate = useCallback((r: Route) => {
    const next = r === "home" ? "#/" : `#/${r}`;
    if (window.location.hash === next) return;
    window.location.hash = next; // fires hashchange -> setRoute
  }, []);

  return { route, navigate };
}
