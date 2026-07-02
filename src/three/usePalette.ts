import { useEffect, useState } from "react";
import { readPalette, type RiskPalette } from "@/three/riskColors";

/** Whether the dark theme is currently active (drives 3D material tuning). */
export function isDarkTheme(): boolean {
  return document.documentElement.classList.contains("dark");
}

/**
 * Theme-reactive palette for 3D scenes: re-reads the CSS token colors whenever
 * the html class changes (light/dark toggle), so materials never go stale -
 * a scene mounted in dark mode must not keep neon colors on a white page.
 */
export function usePalette(): { palette: RiskPalette; dark: boolean } {
  const [state, setState] = useState(() => ({ palette: readPalette(), dark: isDarkTheme() }));

  useEffect(() => {
    const observer = new MutationObserver(() => {
      setState({ palette: readPalette(), dark: isDarkTheme() });
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  return state;
}
