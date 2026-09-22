import { describe, it, expect } from "vitest";
import { buildNotificationText } from "../notificationText";
import { computeRemaining } from "../remaining";

describe("buildNotificationText", () => {
  it("rest day morning message never implies a workout", () => {
    const result = buildNotificationText({ ruleType: "morning_preview", dayLabel: "Rest", dayType: "REST", remaining: null, privacy: "detailed" });
    expect(result.body).toMatch(/Rest day/);
  });

  it("suppresses the evening reminder when everything applicable is done", () => {
    const remaining = computeRemaining({
      dayType: "STRENGTH",
      cardioMandatory: false,
      sessionStatus: "COMPLETED",
      hasCardioLog: true,
      hasDailyLogNutrition: true,
      hasDailyLogWeight: true,
    });
    const result = buildNotificationText({ ruleType: "evening_unfinished", dayLabel: "Upper A", dayType: "STRENGTH", remaining, privacy: "detailed" });
    expect(result.suppress).toBe(true);
  });

  it("a finished session never receives a not-started-style reminder", () => {
    const remaining = computeRemaining({
      dayType: "STRENGTH",
      cardioMandatory: false,
      sessionStatus: "PARTIAL",
      hasCardioLog: false,
      hasDailyLogNutrition: false,
      hasDailyLogWeight: false,
    });
    // PARTIAL counts as "done" for the required workout item — only unfinished
    // required items should appear in the body.
    const result = buildNotificationText({ ruleType: "evening_unfinished", dayLabel: "Upper A", dayType: "STRENGTH", remaining, privacy: "detailed" });
    expect(result.body).not.toMatch(/Strength session/);
  });

  it("mentions unfinished required items by name in detailed mode", () => {
    const remaining = computeRemaining({
      dayType: "STRENGTH",
      cardioMandatory: false,
      sessionStatus: "NOT_STARTED",
      hasCardioLog: false,
      hasDailyLogNutrition: false,
      hasDailyLogWeight: false,
    });
    const result = buildNotificationText({ ruleType: "evening_unfinished", dayLabel: "Upper A", dayType: "STRENGTH", remaining, privacy: "detailed" });
    expect(result.suppress).toBe(false);
    expect(result.body).toMatch(/Strength session/);
  });

  it("generic privacy mode omits plan/task names", () => {
    const remaining = computeRemaining({
      dayType: "STRENGTH",
      cardioMandatory: false,
      sessionStatus: "NOT_STARTED",
      hasCardioLog: false,
      hasDailyLogNutrition: false,
      hasDailyLogWeight: false,
    });
    const result = buildNotificationText({ ruleType: "evening_unfinished", dayLabel: "Upper A", dayType: "STRENGTH", remaining, privacy: "generic" });
    expect(result.body).not.toMatch(/Upper A|Strength session/);
  });

  it("optional recovery day is never treated as unfinished work", () => {
    const remaining = computeRemaining({
      dayType: "OPTIONAL_RECOVERY",
      cardioMandatory: false,
      sessionStatus: null,
      hasCardioLog: false,
      hasDailyLogNutrition: false,
      hasDailyLogWeight: false,
    });
    expect(remaining.required.length).toBe(0);
    const result = buildNotificationText({ ruleType: "evening_unfinished", dayLabel: "Optional recovery", dayType: "OPTIONAL_RECOVERY", remaining, privacy: "detailed" });
    expect(result.suppress).toBe(true);
  });

  it("rest day generates no workout-incomplete reminder", () => {
    const remaining = computeRemaining({
      dayType: "REST",
      cardioMandatory: false,
      sessionStatus: null,
      hasCardioLog: false,
      hasDailyLogNutrition: false,
      hasDailyLogWeight: false,
    });
    expect(remaining.required.length).toBe(0);
    const result = buildNotificationText({ ruleType: "evening_unfinished", dayLabel: "Rest", dayType: "REST", remaining, privacy: "detailed" });
    expect(result.suppress).toBe(true);
  });
});
