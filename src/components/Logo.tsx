/**
 * Ergo AI mark - an abstract pose skeleton (head, trunk, raised arm joints) with
 * a highlighted angle arc at the shoulder, mirroring the upper-arm elevation that
 * drives the RULA score and the MediaPipe skeleton the app actually renders.
 * Self-contained (own rounded background) so it doubles as the favicon artwork.
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
      <defs>
        {/* Deep premium dark background gradient */}
        <linearGradient id="logo-bg-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#4f46e5" />
          <stop offset="50%" stopColor="#312e81" />
          <stop offset="100%" stopColor="#090514" />
        </linearGradient>
        {/* Soft neon glow filter */}
        <filter id="logo-glow" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="0.8" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      {/* Background card with gradient */}
      <rect width="32" height="32" rx="8" fill="url(#logo-bg-grad)" />
      
      {/* Glossy inner glassmorphic border */}
      <rect x="0.75" y="0.75" width="30.5" height="30.5" rx="7.25" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="0.75" />

      {/* Angle arc highlight - Neon Rose */}
      <path
        d="M 13 20.5 A 5.5 5.5 0 0 1 18.2 12.5"
        fill="none"
        stroke="#f43f5e"
        strokeWidth="1.8"
        strokeLinecap="round"
        filter="url(#logo-glow)"
      />

      {/* Skeleton edges - Electric Cyan */}
      <g stroke="#38bdf8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" filter="url(#logo-glow)">
        <path d="M15.8 8.5 L13 15" />
        <path d="M13 15 L22 12" />
        <path d="M13 15 L13.8 24" />
      </g>

      {/* Joint nodes - Bright Emerald */}
      <g fill="#34d399" filter="url(#logo-glow)">
        <circle cx="15.8" cy="8" r="2.8" />
        <circle cx="13" cy="15" r="1.6" />
        <circle cx="22" cy="12" r="1.6" />
        <circle cx="13.8" cy="24" r="1.6" />
      </g>
    </svg>
  );
}
