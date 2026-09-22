// Timezone-aware local-date helpers. All "local date" values in this app are
// plain YYYY-MM-DD strings computed from the owner's configured IANA timezone,
// never sliced from a UTC ISO timestamp.

export function todayLocalDate(timezone: string): string {
  return instantToLocalDate(new Date(), timezone);
}

export function instantToLocalDate(instant: Date, timezone: string): string {
  // en-CA formats as YYYY-MM-DD, which is exactly the ISO calendar-date shape we want.
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return fmt.format(instant);
}

export function localTimeInTimezone(timezone: string): string {
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  return fmt.format(new Date());
}

function parseLocalDate(localDate: string): { y: number; m: number; d: number } {
  const [y, m, d] = localDate.split("-").map(Number);
  return { y, m, d };
}

// Difference in whole calendar days between two YYYY-MM-DD local-date strings
// (b - a), computed as pure calendar math with no timezone involved.
export function calendarDaysBetween(a: string, b: string): number {
  const pa = parseLocalDate(a);
  const pb = parseLocalDate(b);
  const utcA = Date.UTC(pa.y, pa.m - 1, pa.d);
  const utcB = Date.UTC(pb.y, pb.m - 1, pb.d);
  return Math.round((utcB - utcA) / 86400000);
}

export function addCalendarDays(localDate: string, days: number): string {
  const p = parseLocalDate(localDate);
  const utc = Date.UTC(p.y, p.m - 1, p.d) + days * 86400000;
  const dt = new Date(utc);
  const y = dt.getUTCFullYear();
  const m = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const d = String(dt.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export interface CycleInfo {
  hasStarted: boolean;
  dayNumber: number; // 1-7
  weekNumber: number; // 1-based
  daysUntilStart?: number;
}

// programStartDate and targetLocalDate are both YYYY-MM-DD local-date strings
// in the owner's configured timezone.
export function computeCycle(programStartDate: string, targetLocalDate: string): CycleInfo {
  const diff = calendarDaysBetween(programStartDate, targetLocalDate);
  if (diff < 0) {
    return { hasStarted: false, dayNumber: 0, weekNumber: 0, daysUntilStart: -diff };
  }
  const dayNumber = (diff % 7) + 1;
  const weekNumber = Math.floor(diff / 7) + 1;
  return { hasStarted: true, dayNumber, weekNumber };
}

// Converts a local YYYY-MM-DD + HH:MM in the given IANA timezone to the
// corresponding UTC instant, by measuring that timezone's offset at the
// naive-UTC guess and correcting for it.
export function localDateTimeToUTC(localDate: string, localTime: string, timezone: string): Date {
  const { y, m, d } = parseLocalDate(localDate);
  const [hh, mm] = localTime.split(":").map(Number);
  const naiveUtcMs = Date.UTC(y, m - 1, d, hh, mm, 0);

  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(naiveUtcMs));

  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? "0");
  const shownAsUtcMs = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour") % 24, get("minute"), get("second"));
  const offsetMs = shownAsUtcMs - naiveUtcMs;
  return new Date(naiveUtcMs - offsetMs);
}

export function isoWeekday(localDate: string, timezone: string): number {
  // 1 = Monday ... 7 = Sunday, matching the brief's "active days" convention.
  const instant = localDateTimeToUTC(localDate, "12:00", timezone);
  const fmt = new Intl.DateTimeFormat("en-US", { timeZone: timezone, weekday: "short" });
  const map: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };
  return map[fmt.format(instant)] ?? 1;
}

export function isValidLocalDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const { y, m, d } = parseLocalDate(value);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}
