const MONTHS: Record<string, number> = {
  jan: 0,
  january: 0,
  feb: 1,
  february: 1,
  mar: 2,
  march: 2,
  apr: 3,
  april: 3,
  may: 4,
  jun: 5,
  june: 5,
  jul: 6,
  july: 6,
  aug: 7,
  august: 7,
  sep: 8,
  sept: 8,
  september: 8,
  oct: 9,
  october: 9,
  nov: 10,
  november: 10,
  dec: 11,
  december: 11,
};

export type ParsedDate = {
  iso: string;
  date: Date;
  hasTime: boolean;
};

function buildDate(
  year: number,
  monthIndex: number,
  day: number,
  time?: { hours: number; minutes: number },
): ParsedDate | null {
  if (!Number.isInteger(year) || !Number.isInteger(monthIndex) || !Number.isInteger(day)) {
    return null;
  }
  if (monthIndex < 0 || monthIndex > 11 || day < 1 || day > 31) return null;
  if (year < 1990 || year > 2100) return null;

  const date = new Date(Date.UTC(year, monthIndex, day, time?.hours ?? 0, time?.minutes ?? 0));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== monthIndex ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  const iso = time
    ? `${year.toString().padStart(4, "0")}-${(monthIndex + 1).toString().padStart(2, "0")}-${day
        .toString()
        .padStart(2, "0")}T${time.hours.toString().padStart(2, "0")}:${time.minutes
        .toString()
        .padStart(2, "0")}`
    : `${year.toString().padStart(4, "0")}-${(monthIndex + 1).toString().padStart(2, "0")}-${day
        .toString()
        .padStart(2, "0")}`;

  return { iso, date, hasTime: Boolean(time) };
}

function parseTime(value: string | undefined): { hours: number; minutes: number } | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  const match = /^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i.exec(trimmed);
  if (!match) return undefined;

  let hours = Number(match[1]);
  const minutes = Number(match[2]);
  const meridiem = match[3]?.toUpperCase();

  if (minutes > 59) return undefined;
  if (meridiem) {
    if (hours < 1 || hours > 12) return undefined;
    if (meridiem === "PM" && hours < 12) hours += 12;
    if (meridiem === "AM" && hours === 12) hours = 0;
  } else if (hours > 23) {
    return undefined;
  }

  return { hours, minutes };
}

export function parseDateValue(raw: string, referenceYear?: number): ParsedDate | null {
  const value = raw.trim().replace(/\s+/g, " ");
  if (!value) return null;

  const timeSuffix =
    "(?:[,\\s]+(\\d{1,2}:\\d{2}\\s*(?:AM|PM)?))?";

  const isoMatch = new RegExp(`^(\\d{4})-(\\d{2})-(\\d{2})${timeSuffix}$`, "i").exec(value);
  if (isoMatch) {
    return buildDate(
      Number(isoMatch[1]),
      Number(isoMatch[2]) - 1,
      Number(isoMatch[3]),
      parseTime(isoMatch[4]),
    );
  }

  const numeric = new RegExp(
    `^(\\d{1,2})[\\/.\\-](\\d{1,2})[\\/.\\-](\\d{4}|\\d{2})${timeSuffix}$`,
    "i",
  ).exec(value);
  if (numeric) {
    let year = Number(numeric[3]);
    if (numeric[3].length === 2) {
      const base = referenceYear ?? new Date().getUTCFullYear();
      year = Math.floor(base / 100) * 100 + year;
      if (year > base + 1) year -= 100;
    }
    // Nigerian banking messages use day-first dates.
    return buildDate(year, Number(numeric[2]) - 1, Number(numeric[1]), parseTime(numeric[4]));
  }

  const dayMonthName = new RegExp(
    `^(\\d{1,2})[\\s-]+([A-Za-z]{3,9})[,\\s-]+(\\d{4})${timeSuffix}$`,
    "i",
  ).exec(value);
  if (dayMonthName) {
    const month = MONTHS[dayMonthName[2].toLowerCase()];
    if (month === undefined) return null;
    return buildDate(Number(dayMonthName[3]), month, Number(dayMonthName[1]), parseTime(dayMonthName[4]));
  }

  const monthNameDay = new RegExp(
    `^([A-Za-z]{3,9})\\s+(\\d{1,2})[,\\s]+(\\d{4})${timeSuffix}$`,
    "i",
  ).exec(value);
  if (monthNameDay) {
    const month = MONTHS[monthNameDay[1].toLowerCase()];
    if (month === undefined) return null;
    return buildDate(Number(monthNameDay[3]), month, Number(monthNameDay[2]), parseTime(monthNameDay[4]));
  }

  const dayMonthNameNoYear = new RegExp(`^(\\d{1,2})[\\s-]+([A-Za-z]{3,9})${timeSuffix}$`, "i").exec(value);
  if (dayMonthNameNoYear && referenceYear) {
    const month = MONTHS[dayMonthNameNoYear[2].toLowerCase()];
    if (month === undefined) return null;
    return buildDate(referenceYear, month, Number(dayMonthNameNoYear[1]), parseTime(dayMonthNameNoYear[3]));
  }

  return null;
}

export function parseDateParts(
  day: string,
  month: string,
  year: string,
  referenceYear?: number,
): ParsedDate | null {
  return parseDateValue(`${day}/${month}/${year}`, referenceYear);
}

export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return "Not provided";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "Not provided";
  return new Intl.DateTimeFormat("en-NG", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    timeZone: "UTC",
  }).format(date);
}

export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return "Not provided";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "Not provided";
  return new Intl.DateTimeFormat("en-NG", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
    hour12: false,
  }).format(date);
}

export function dayKey(value: string | Date): string {
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "unknown";
  return date.toISOString().slice(0, 10);
}

export function daysBetween(a: Date, b: Date): number {
  return Math.abs(Math.round((a.getTime() - b.getTime()) / (24 * 60 * 60 * 1000)));
}
