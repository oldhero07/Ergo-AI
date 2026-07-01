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
      <rect width="32" height="32" rx="7" fill="#1e293b" />
      {/* skeleton edges */}
      <g stroke="#e2e8f0" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" fill="none">
        <path d="M15.5 10 L13 15" />
        <path d="M13 15 L13.8 24" />
        <path d="M13 15 L22 11.5" />
      </g>
      {/* upper-arm angle arc (the RULA driver), in landmark rose */}
      <path d="M13 21 A 6 6 0 0 1 18.6 12.2" fill="none" stroke="#f43f5e" strokeWidth="1.7" strokeLinecap="round" />
      {/* joint nodes */}
      <g fill="#10b981">
        <circle cx="15.8" cy="8" r="3.1" />
        <circle cx="13" cy="15" r="1.9" />
        <circle cx="22" cy="11.5" r="1.9" />
        <circle cx="13.8" cy="24" r="1.9" />
      </g>
    </svg>
  );
}
