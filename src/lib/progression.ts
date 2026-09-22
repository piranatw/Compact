import type { LastComparableSession } from "./history";

export interface ProgressionInput {
  workingSets: number;
  targetRepsHigh: number | null;
  defaultIncrementKg: number | null;
  lastComparable: LastComparableSession | null;
}

export interface ProgressionResult {
  eligible: boolean;
  reason: string;
  suggestedIncrementKg: number | null;
}

// Transparent, testable, deterministic progression helper (brief section 8).
// A suggestion, never an automatic change: every prescribed working set in the
// latest comparable session must reach the upper end of the rep range, every
// one of those sets must have at least 2 RIR logged, and none may be flagged
// for pain. Missing RIR, missing increment config, or a fixed-rep exercise
// (no upper rep target) all mean no automatic increase recommendation.
export function computeProgression(input: ProgressionInput): ProgressionResult {
  if (input.targetRepsHigh == null) {
    return { eligible: false, reason: "Fixed-rep or timed exercise: manual progression only.", suggestedIncrementKg: null };
  }
  if (!input.lastComparable) {
    return { eligible: false, reason: "No comparable prior session yet.", suggestedIncrementKg: null };
  }
  const workingSets = input.lastComparable.sets.filter((s) => !s.isWarmup);
  if (workingSets.length < input.workingSets) {
    return { eligible: false, reason: "Latest comparable session did not complete all prescribed working sets.", suggestedIncrementKg: null };
  }
  const anyIncomplete = workingSets.some((s) => s.actualReps == null || s.actualWeightKg == null);
  if (anyIncomplete) {
    return { eligible: false, reason: "Latest comparable session has missing set data.", suggestedIncrementKg: null };
  }
  const anyPain = workingSets.some((s) => s.painFlag);
  if (anyPain) {
    return { eligible: false, reason: "Pain was flagged on this exercise; no heavier-load suggestion.", suggestedIncrementKg: null };
  }
  const allAtUpperRange = workingSets.every((s) => (s.actualReps ?? 0) >= input.targetRepsHigh!);
  if (!allAtUpperRange) {
    return { eligible: false, reason: "Not every working set reached the upper end of the rep range.", suggestedIncrementKg: null };
  }
  const anyMissingRir = workingSets.some((s) => s.rir == null);
  if (anyMissingRir) {
    return { eligible: false, reason: "RIR was not logged for every set; no automatic suggestion.", suggestedIncrementKg: null };
  }
  const allAtLeast2Rir = workingSets.every((s) => (s.rir ?? 0) >= 2);
  if (!allAtLeast2Rir) {
    return { eligible: false, reason: "At least one set was logged below 2 RIR.", suggestedIncrementKg: null };
  }
  if (input.defaultIncrementKg == null) {
    return { eligible: false, reason: "No configured load increment for this equipment yet.", suggestedIncrementKg: null };
  }
  return {
    eligible: true,
    reason: "Every prescribed working set reached the upper rep target at 2+ RIR with no pain flagged.",
    suggestedIncrementKg: input.defaultIncrementKg,
  };
}
