import { addCalendarDays } from "./date";

export interface WindowStat {
  from: string;
  to: string;
  mean: number | null;
  count: number;
}

export function computeWindowStat(weightsByDate: Map<string, number>, endDate: string): WindowStat {
  const from = addCalendarDays(endDate, -6);
  const values: number[] = [];
  for (let i = 0; i < 7; i++) {
    const d = addCalendarDays(from, i);
    const w = weightsByDate.get(d);
    if (w != null) values.push(w);
  }
  const mean = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : null;
  return { from, to: endDate, mean, count: values.length };
}

export interface WeekComparison {
  status: "ok" | "insufficient";
  currentWindow: WindowStat;
  previousWindow: WindowStat;
  deltaKg: number | null;
}

const MIN_DAYS_FOR_TREND = 3;

// Non-overlapping seven-day windows. At least 3 recorded days required in
// EACH window for a trend insight; this is an app rule against sparse-data
// conclusions, not a medical standard.
export function computeWeekComparison(weightsByDate: Map<string, number>, endDate: string): WeekComparison {
  const currentWindow = computeWindowStat(weightsByDate, endDate);
  const previousEnd = addCalendarDays(endDate, -7);
  const previousWindow = computeWindowStat(weightsByDate, previousEnd);

  if (currentWindow.count < MIN_DAYS_FOR_TREND || previousWindow.count < MIN_DAYS_FOR_TREND) {
    return { status: "insufficient", currentWindow, previousWindow, deltaKg: null };
  }
  return {
    status: "ok",
    currentWindow,
    previousWindow,
    deltaKg: round2(currentWindow.mean! - previousWindow.mean!),
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
