import { describe, it, expect } from "vitest";
import { computeProgression } from "../progression";
import type { LastComparableSession } from "../history";

function session(sets: LastComparableSession["sets"]): LastComparableSession {
  return { sessionId: "s1", finishedAt: null, sets };
}

const baseInput = {
  workingSets: 3,
  targetRepsHigh: 12,
  defaultIncrementKg: 2.5,
};

describe("computeProgression", () => {
  it("suggests the next increment when every set hits the top of the range at 2+ RIR with no pain", () => {
    const result = computeProgression({
      ...baseInput,
      lastComparable: session([
        { setIndex: 1, side: null, equipmentKey: "A", actualWeightKg: 30, actualReps: 12, actualSeconds: null, rir: 2, painFlag: false, isWarmup: false },
        { setIndex: 2, side: null, equipmentKey: "A", actualWeightKg: 30, actualReps: 12, actualSeconds: null, rir: 2, painFlag: false, isWarmup: false },
        { setIndex: 3, side: null, equipmentKey: "A", actualWeightKg: 30, actualReps: 12, actualSeconds: null, rir: 3, painFlag: false, isWarmup: false },
      ]),
    });
    expect(result.eligible).toBe(true);
    expect(result.suggestedIncrementKg).toBe(2.5);
  });

  it("does not suggest when one set falls short of the rep target (12, 10, 8 example from the brief)", () => {
    const result = computeProgression({
      ...baseInput,
      lastComparable: session([
        { setIndex: 1, side: null, equipmentKey: "A", actualWeightKg: 30, actualReps: 12, actualSeconds: null, rir: 2, painFlag: false, isWarmup: false },
        { setIndex: 2, side: null, equipmentKey: "A", actualWeightKg: 30, actualReps: 10, actualSeconds: null, rir: 2, painFlag: false, isWarmup: false },
        { setIndex: 3, side: null, equipmentKey: "A", actualWeightKg: 30, actualReps: 8, actualSeconds: null, rir: 2, painFlag: false, isWarmup: false },
      ]),
    });
    expect(result.eligible).toBe(false);
  });

  it("does not suggest when RIR is missing on any set", () => {
    const result = computeProgression({
      ...baseInput,
      lastComparable: session([
        { setIndex: 1, side: null, equipmentKey: "A", actualWeightKg: 30, actualReps: 12, actualSeconds: null, rir: 2, painFlag: false, isWarmup: false },
        { setIndex: 2, side: null, equipmentKey: "A", actualWeightKg: 30, actualReps: 12, actualSeconds: null, rir: null, painFlag: false, isWarmup: false },
        { setIndex: 3, side: null, equipmentKey: "A", actualWeightKg: 30, actualReps: 12, actualSeconds: null, rir: 2, painFlag: false, isWarmup: false },
      ]),
    });
    expect(result.eligible).toBe(false);
    expect(result.reason).toMatch(/RIR/);
  });

  it("never suggests a heavier load when pain was flagged on any set", () => {
    const result = computeProgression({
      ...baseInput,
      lastComparable: session([
        { setIndex: 1, side: null, equipmentKey: "A", actualWeightKg: 30, actualReps: 12, actualSeconds: null, rir: 2, painFlag: false, isWarmup: false },
        { setIndex: 2, side: null, equipmentKey: "A", actualWeightKg: 30, actualReps: 12, actualSeconds: null, rir: 2, painFlag: true, isWarmup: false },
        { setIndex: 3, side: null, equipmentKey: "A", actualWeightKg: 30, actualReps: 12, actualSeconds: null, rir: 2, painFlag: false, isWarmup: false },
      ]),
    });
    expect(result.eligible).toBe(false);
    expect(result.reason).toMatch(/[Pp]ain/);
  });

  it("treats a fixed-rep / timed exercise (no upper rep target) as manual-only", () => {
    const result = computeProgression({ ...baseInput, targetRepsHigh: null, lastComparable: null });
    expect(result.eligible).toBe(false);
  });

  it("does not suggest without a configured increment even if performance qualifies", () => {
    const result = computeProgression({
      ...baseInput,
      defaultIncrementKg: null,
      lastComparable: session([
        { setIndex: 1, side: null, equipmentKey: "A", actualWeightKg: 30, actualReps: 12, actualSeconds: null, rir: 2, painFlag: false, isWarmup: false },
        { setIndex: 2, side: null, equipmentKey: "A", actualWeightKg: 30, actualReps: 12, actualSeconds: null, rir: 2, painFlag: false, isWarmup: false },
        { setIndex: 3, side: null, equipmentKey: "A", actualWeightKg: 30, actualReps: 12, actualSeconds: null, rir: 2, painFlag: false, isWarmup: false },
      ]),
    });
    expect(result.eligible).toBe(false);
    expect(result.suggestedIncrementKg).toBeNull();
  });

  it("does not suggest when fewer working sets were completed than prescribed", () => {
    const result = computeProgression({
      ...baseInput,
      lastComparable: session([
        { setIndex: 1, side: null, equipmentKey: "A", actualWeightKg: 30, actualReps: 12, actualSeconds: null, rir: 2, painFlag: false, isWarmup: false },
        { setIndex: 2, side: null, equipmentKey: "A", actualWeightKg: 30, actualReps: 12, actualSeconds: null, rir: 2, painFlag: false, isWarmup: false },
      ]),
    });
    expect(result.eligible).toBe(false);
  });
});
