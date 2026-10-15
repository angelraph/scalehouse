/**
 * The Scalehouse mark: an S that is also a path, under a house roof, with the scale pan and
 * fulcrum in gold, ending in a leaf. Redrawn as a vector from the brand logo.
 */
export function Mark({ size = 32, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" className={className} aria-hidden>
      <defs>
        <linearGradient id="sh-s" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#1d6b3a" />
          <stop offset="1" stopColor="#0d4424" />
        </linearGradient>
        <linearGradient id="sh-leaf" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#5a9a3c" />
          <stop offset="1" stopColor="#2f7a35" />
        </linearGradient>
      </defs>
      {/* roof */}
      <path d="M33 25 L57 9.5 L84 25.5 V45" fill="none" stroke="url(#sh-s)" strokeWidth="7.5" strokeLinejoin="miter" />
      {/* the S */}
      <path d="M38 22.5 C18 29 19 47 39 51 L61 55.5 C80 59.5 80 77 66 82" fill="none" stroke="url(#sh-s)" strokeWidth="13" strokeLinecap="butt" />
      <path d="M69 78 V95" stroke="#0d4424" strokeWidth="8.5" />
      {/* leaf terminal */}
      <path d="M16 57 C35 53 55 59 58 90 C47 73 33 65 16 57 Z" fill="url(#sh-s)" />
      <path d="M31 66 C44 66 52 73 54 85 C46 77 39 71 31 66 Z" fill="url(#sh-leaf)" />
      {/* scale: pan, stem, fulcrum */}
      <path d="M45 33 H69 A12 8.5 0 0 1 45 33 Z" fill="#e8ae45" />
      <path d="M57 33 V25" stroke="#0d4424" strokeWidth="2.6" />
      <path d="M53 25.5 L57 16 L61 25.5 Z" fill="#0d4424" />
    </svg>
  );
}

/** Mark plus the serif wordmark, as on the brand logo. */
export function Logo({ size = 32, light = false }: { size?: number; light?: boolean }) {
  return (
    <span className="flex items-center gap-1.5 sm:gap-2">
      <Mark size={size} className="h-7 w-7 sm:h-auto sm:w-auto" />
      <span className={`wordmark text-[1.15rem] leading-none sm:text-[1.35rem] ${light ? "text-[#f3efe2]" : "text-forest"}`}>Scalehouse</span>
    </span>
  );
}
