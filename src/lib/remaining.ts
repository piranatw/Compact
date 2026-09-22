// Derives what's left for a given day from actual scheduled tasks and logs —
// never a stored/cached percentage that can drift out of sync.

export interface RemainingItem {
  key: string;
  label: string;
  done: boolean;
}

export interface RemainingSummary {
  required: RemainingItem[];
  optional: RemainingItem[];
  optionalMeasurements: RemainingItem[];
}

export interface OccurrenceLike {
  workoutTemplate: { dayType: string; cardioMandatory: boolean } | null;
}

export function computeRemaining(params: {
  dayType: string | null;
  cardioMandatory: boolean;
  sessionStatus: string | null; // NOT_STARTED | IN_PROGRESS | COMPLETED | PARTIAL | null (no template)
  hasCardioLog: boolean;
  hasDailyLogNutrition: boolean;
  hasDailyLogWeight: boolean;
}): RemainingSummary {
  const required: RemainingItem[] = [];
  const optional: RemainingItem[] = [];
  const optionalMeasurements: RemainingItem[] = [];

  if (params.dayType === "STRENGTH") {
    required.push({
      key: "workout",
      label: "Strength session",
      done: params.sessionStatus === "COMPLETED" || params.sessionStatus === "PARTIAL",
    });
  } else if (params.dayType === "CARDIO_RECOVERY") {
    // Cardio/recovery day: cardio is the day's content but never mandatory.
    optional.push({ key: "cardio", label: "Cardio session", done: params.hasCardioLog });
  }
  // REST and OPTIONAL_RECOVERY days generate no required or nag-worthy items.

  if (params.dayType === "STRENGTH" && params.cardioMandatory) {
    required.push({ key: "cardio", label: "Planned cardio", done: params.hasCardioLog });
  } else if (params.dayType === "STRENGTH") {
    optional.push({ key: "cardio", label: "Planned cardio (optional)", done: params.hasCardioLog });
  }

  optional.push({ key: "nutrition", label: "Daily nutrition log", done: params.hasDailyLogNutrition });
  optionalMeasurements.push({ key: "weight", label: "Bodyweight", done: params.hasDailyLogWeight });

  return { required, optional, optionalMeasurements };
}
