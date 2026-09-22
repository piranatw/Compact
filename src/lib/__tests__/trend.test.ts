import { describe, it, expect } from "vitest";
import { computeWeekComparison, computeWindowStat } from "../trend";

function mapFrom(entries: Array<[string, number]>): Map<string, number> {
  return new Map(entries);
}

describe("computeWindowStat", () => {
  it("averages only recorded days and reports the sample count", () => {
    const stat = computeWindowStat(
      mapFrom([
        ["2026-01-05", 75],
        ["2026-01-06", 74],
      ]),
      "2026-01-06"
    );
    expect(stat.count).toBe(2);
    expect(stat.mean).toBe(74.5);
    expect(stat.from).toBe("2025-12-31");
  });

  it("never interpolates or repeats the last value for missing days", () => {
    const stat = computeWindowStat(mapFrom([["2026-01-06", 74]]), "2026-01-06");
    expect(stat.count).toBe(1);
    expect(stat.mean).toBe(74);
  });
});

describe("computeWeekComparison", () => {
  it("requires at least 3 recorded days in EACH window", () => {
    const weights = mapFrom([
      ["2026-01-13", 74],
      ["2026-01-14", 74],
      // only 2 days this window
      ["2026-01-06", 76],
      ["2026-01-07", 76],
      ["2026-01-08", 76],
    ]);
    const result = computeWeekComparison(weights, "2026-01-14");
    expect(result.status).toBe("insufficient");
    expect(result.deltaKg).toBeNull();
  });

  it("computes a delta once both non-overlapping windows have >= 3 days", () => {
    const weights = mapFrom([
      ["2026-01-12", 74],
      ["2026-01-13", 74],
      ["2026-01-14", 74],
      ["2026-01-05", 76],
      ["2026-01-06", 76],
      ["2026-01-07", 76],
    ]);
    const result = computeWeekComparison(weights, "2026-01-14");
    expect(result.status).toBe("ok");
    expect(result.deltaKg).toBe(-2);
  });

  it("uses non-overlapping windows: current window excludes the previous window's days", () => {
    const weights = mapFrom([
      ["2026-01-14", 70],
      ["2026-01-13", 70],
      ["2026-01-12", 70],
      ["2026-01-07", 80], // in the previous window, must not leak into current
      ["2026-01-06", 80],
      ["2026-01-05", 80],
    ]);
    const result = computeWeekComparison(weights, "2026-01-14");
    expect(result.currentWindow.mean).toBe(70);
    expect(result.previousWindow.mean).toBe(80);
  });
});
