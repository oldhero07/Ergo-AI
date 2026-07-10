/**
 * Ergo AI mark - an abstract pose skeleton (head, trunk, raised arm joints)
 * with a highlighted angle arc at the shoulder, mirroring the upper-arm
 * elevation that drives the RULA score. Clinical mark: solid clinical-blue
 * rounded square, white figure - no gradients, no glow filters. Keep in sync
 * with public/favicon.svg (which hardcodes the hex because it renders outside
 * the CSS cascade).
 */
export function Logo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      className={className}
      role="img"
      aria-label="Ergo AI"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Clinical blue badge */}
      <rect width="32" height="32" rx="8" fill="hsl(var(--primary))" />

      {/* Angle arc highlight */}
      <path
        d="M 13 20.5 A 5.5 5.5 0 0 1 18.2 12.5"
        fill="none"
        stroke="hsl(var(--primary-foreground))"
        strokeOpacity="0.55"
        strokeWidth="1.6"
        strokeLinecap="round"
      />

      {/* Skeleton edges */}
      <g stroke="hsl(var(--primary-foreground))" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none">
        <path d="M15.8 8.5 L13 15" />
        <path d="M13 15 L22 12" />
        <path d="M13 15 L13.8 24" />
      </g>

      {/* Joint nodes */}
      <g fill="hsl(var(--primary-foreground))">
        <circle cx="15.8" cy="8" r="2.8" />
        <circle cx="13" cy="15" r="1.6" />
        <circle cx="22" cy="12" r="1.6" />
        <circle cx="13.8" cy="24" r="1.6" />
      </g>
    </svg>
  );
}
