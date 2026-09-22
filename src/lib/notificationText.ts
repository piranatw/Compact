import type { RemainingSummary } from "./remaining";

export interface NotificationTextInput {
  ruleType: string;
  dayLabel: string | null;
  dayType: string | null;
  remaining: RemainingSummary | null;
  privacy: "detailed" | "generic";
}

export interface NotificationTextResult {
  suppress: boolean;
  title: string;
  body: string;
}

// Text is generated fresh from current stored state at send time — never a
// template that assumes anything is still pending. A finished session never
// receives a not-started reminder, optional recovery is never "unfinished",
// and if everything applicable is done the evening reminder is suppressed.
export function buildNotificationText(input: NotificationTextInput): NotificationTextResult {
  const generic = input.privacy === "generic";

  if (input.ruleType === "morning_preview") {
    if (input.dayType === "REST") {
      return { suppress: false, title: "Compact", body: "Rest day today. No workout is scheduled." };
    }
    if (!input.dayLabel) {
      return { suppress: false, title: "Compact", body: "Today's plan is ready." };
    }
    const body = generic ? "Your plan for today is ready." : `${input.dayLabel} today. Your workout and cardio plan are ready.`;
    return { suppress: false, title: "Compact", body };
  }

  if (input.ruleType === "evening_unfinished") {
    if (!input.remaining) {
      return { suppress: true, title: "", body: "" };
    }
    const unfinishedRequired = input.remaining.required.filter((r) => !r.done);
    if (unfinishedRequired.length === 0) {
      // All applicable required work is done: suppress rather than send an empty/positive nag.
      return { suppress: true, title: "", body: "" };
    }
    const names = unfinishedRequired.map((r) => r.label).join(", ");
    const body = generic
      ? "You have unfinished planned items today."
      : `Today's plan is still unfinished: ${names}.`;
    return { suppress: false, title: "Compact", body };
  }

  return { suppress: true, title: "", body: "" };
}
