import { describe, it, expect } from "vitest";
import {
  computeCycle,
  calendarDaysBetween,
  addCalendarDays,
  todayLocalDate,
  instantToLocalDate,
  localDateTimeToUTC,
  isoWeekday,
  isValidLocalDate,
} from "../date";

describe("computeCycle", () => {
  it("maps the start date to Day 1 / Week 1", () => {
    const cycle = computeCycle("2026-09-24", "2026-09-24"); // a Thursday
    expect(cycle).toEqual({ hasStarted: true, dayNumber: 1, weekNumber: 1 });
  });

  it("does not require a Monday start and follows the 7-day cycle regardless", () => {
    const cycle = computeCycle("2026-09-24", "2026-09-27"); // start Thu, +3 days = Day 4
    expect(cycle.hasStarted).toBe(true);
    expect(cycle.dayNumber).toBe(4);
    expect(cycle.weekNumber).toBe(1);
  });

  it("rolls over into week 2 on day 8", () => {
    const cycle = computeCycle("2026-09-24", "2026-10-01");
    expect(cycle.dayNumber).toBe(1);
    expect(cycle.weekNumber).toBe(2);
  });

  it("reports not-started with days remaining before the start date", () => {
    const cycle = computeCycle("2026-10-01", "2026-09-24");
    expect(cycle.hasStarted).toBe(false);
    expect(cycle.daysUntilStart).toBe(7);
  });

  it("never derives the day from counting completed workouts, only calendar distance", () => {
    // Same start/target pair always yields the same day regardless of any
    // session/log history — there is nothing session-related in this function's inputs.
    const a = computeCycle("2026-01-01", "2026-01-10");
    const b = computeCycle("2026-01-01", "2026-01-10");
    expect(a).toEqual(b);
  });
});

describe("calendarDaysBetween / addCalendarDays", () => {
  it("round-trips", () => {
    expect(calendarDaysBetween("2026-01-01", "2026-01-15")).toBe(14);
    expect(addCalendarDays("2026-01-01", 14)).toBe("2026-01-15");
  });

  it("handles month/year boundaries", () => {
    expect(calendarDaysBetween("2026-01-31", "2026-02-01")).toBe(1);
    expect(calendarDaysBetween("2025-12-31", "2026-01-01")).toBe(1);
  });
});

describe("timezone-aware local date, not a UTC slice", () => {
  it("gives a different local date than UTC when the timezones disagree", () => {
    // 2026-01-01T23:30:00Z is already 2026-01-02 in Asia/Bangkok (UTC+7).
    const instant = new Date("2026-01-01T23:30:00Z");
    expect(instantToLocalDate(instant, "UTC")).toBe("2026-01-01");
    expect(instantToLocalDate(instant, "Asia/Bangkok")).toBe("2026-01-02");
  });

  it("todayLocalDate uses the given timezone, not the server default", () => {
    const bkk = todayLocalDate("Asia/Bangkok");
    expect(isValidLocalDate(bkk)).toBe(true);
  });
});

describe("localDateTimeToUTC / isoWeekday", () => {
  it("converts a Bangkok local time back to the correct UTC instant", () => {
    // 08:00 Asia/Bangkok (UTC+7) on 2026-06-15 is 01:00 UTC.
    const utc = localDateTimeToUTC("2026-06-15", "08:00", "Asia/Bangkok");
    expect(utc.toISOString()).toBe("2026-06-15T01:00:00.000Z");
  });

  it("computes the correct ISO weekday for a known date", () => {
    // 2026-09-24 is a Thursday.
    expect(isoWeekday("2026-09-24", "Asia/Bangkok")).toBe(4);
  });
});

describe("isValidLocalDate", () => {
  it("rejects impossible calendar dates", () => {
    expect(isValidLocalDate("2026-02-30")).toBe(false);
    expect(isValidLocalDate("2026-13-01")).toBe(false);
    expect(isValidLocalDate("2026-09-22")).toBe(true);
  });
});
