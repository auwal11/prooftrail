import Link from "next/link";

export function BrandMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <rect width="32" height="32" rx="8" fill="#0e6b5e" />
      <path d="M9 22V10.5h6.2c2.6 0 4.2 1.5 4.2 3.8 0 2.4-1.6 3.9-4.2 3.9H12.6V22H9Z" fill="#ffffff" />
      <circle cx="22.5" cy="22" r="2.2" fill="#f4c95d" />
      <circle cx="17.5" cy="22" r="1.4" fill="#9ed8c9" />
    </svg>
  );
}

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/" className="flex items-center gap-2.5" aria-label="ProofTrail home">
      <BrandMark size={compact ? 24 : 28} />
      <span className={`font-semibold tracking-tight ${compact ? "text-[15px]" : "text-[17px]"}`}>
        ProofTrail
      </span>
    </Link>
  );
}
