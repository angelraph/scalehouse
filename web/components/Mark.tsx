/** The Scalehouse mark: a balanced beam over a fulcrum, inside the house's square. */
export function Mark({ size = 28, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" className={className} aria-hidden>
      <rect width="32" height="32" rx="8" fill="var(--forest)" />
      <path d="M7 12.5h18" stroke="var(--lime)" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M16 12.5L11.5 24h9z" fill="var(--lime)" />
      <circle cx="9" cy="17.5" r="2.2" fill="var(--lime)" />
      <circle cx="23" cy="17.5" r="2.2" fill="var(--lime)" />
      <path d="M9 12.5v2.8M23 12.5v2.8" stroke="var(--lime)" strokeWidth="1.4" />
    </svg>
  );
}
