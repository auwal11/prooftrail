export type ParsedAmount = {
  minor: number;
  currency: string;
  normalized: string;
  formatted: string;
};

const MAX_MINOR = 1_000_000_000_00;

export function parseAmountToMinor(raw: string, currency = "NGN"): ParsedAmount | null {
  const cleaned = raw
    .replace(/[₦,\s]/g, "")
    .replace(/^NGN/i, "")
    .replace(/^N(?=\d)/i, "");

  if (!/^\d+(?:\.\d{1,2})?$/.test(cleaned)) return null;

  const [whole, fraction = ""] = cleaned.split(".");
  const padded = (fraction + "00").slice(0, 2);
  const minor = Number(whole) * 100 + Number(padded);

  if (!Number.isSafeInteger(minor) || minor <= 0 || minor > MAX_MINOR) return null;

  return {
    minor,
    currency,
    normalized: `${currency} ${formatMinor(minor)}`,
    formatted: `${currency} ${formatMinor(minor)}`,
  };
}

export function formatMinor(minor: number): string {
  const whole = Math.floor(minor / 100);
  const fraction = (minor % 100).toString().padStart(2, "0");
  return `${whole.toLocaleString("en-NG")}.${fraction}`;
}

export function formatMoney(value: number | string | null | undefined, currency = "NGN"): string {
  if (value === null || value === undefined || value === "") return "Not provided";
  const amount = typeof value === "string" ? Number(value) : value;
  if (!Number.isFinite(amount)) return "Not provided";
  const minor = Math.round(amount * 100);
  return `${currency} ${formatMinor(minor)}`;
}

export function amountsWithinTolerance(aMinor: number, bMinor: number, toleranceMinor = 1): boolean {
  return Math.abs(aMinor - bMinor) <= toleranceMinor;
}
