import { prisma } from "./prisma";

export interface LastComparableSet {
  setIndex: number;
  side: string | null;
  equipmentKey: string | null;
  actualWeightKg: number | null;
  actualReps: number | null;
  actualSeconds: number | null;
  rir: number | null;
  painFlag: boolean;
  isWarmup: boolean;
}

export interface LastComparableSession {
  sessionId: string;
  finishedAt: string | null;
  sets: LastComparableSet[];
}

// Finds the most recent OTHER session containing completed (non-warmup) sets
// for this exercise, and returns that session's full set list for the exercise.
// Comparability (same exercise definition, equipment identity) is preserved:
// dumbbell and machine history are never merged because equipmentKey travels
// with each set and different equipment is surfaced to the caller rather than
// silently combined.
export async function getLastComparableSession(
  exerciseDefinitionId: string,
  excludeSessionId: string
): Promise<LastComparableSession | null> {
  const lastSet = await prisma.exerciseSet.findFirst({
    where: {
      exerciseDefinitionId,
      sessionId: { not: excludeSessionId },
      status: "completed",
      isWarmup: false,
    },
    orderBy: { createdAt: "desc" },
    include: { session: true },
  });
  if (!lastSet) return null;

  const sets = await prisma.exerciseSet.findMany({
    where: { exerciseDefinitionId, sessionId: lastSet.sessionId },
    orderBy: [{ setIndex: "asc" }],
  });

  return {
    sessionId: lastSet.sessionId,
    finishedAt: lastSet.session.finishedAt ? lastSet.session.finishedAt.toISOString() : null,
    sets: sets.map((s) => ({
      setIndex: s.setIndex,
      side: s.side,
      equipmentKey: s.equipmentKey,
      actualWeightKg: s.actualWeightKg,
      actualReps: s.actualReps,
      actualSeconds: s.actualSeconds,
      rir: s.rir,
      painFlag: s.painFlag,
      isWarmup: s.isWarmup,
    })),
  };
}
