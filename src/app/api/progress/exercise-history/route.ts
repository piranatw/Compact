import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOwnerId } from "@/lib/auth";
import { handleApiError, jsonError } from "@/lib/api";

// Groups completed, non-warmup sets by (exercise, equipmentKey) so machine and
// dumbbell history for the "same" exercise are never merged, and different
// machines/equipment start separate comparable histories.
export async function GET(req: NextRequest) {
  try {
    await requireOwnerId();
    const exerciseKey = req.nextUrl.searchParams.get("exerciseKey");
    if (!exerciseKey) return jsonError(400, "exerciseKey is required");

    const def = await prisma.exerciseDefinition.findUnique({ where: { key: exerciseKey } });
    if (!def) return jsonError(404, "Unknown exercise key");

    const sets = await prisma.exerciseSet.findMany({
      where: { exerciseDefinitionId: def.id, status: "completed", isWarmup: false },
      include: { session: { include: { occurrence: true } } },
      orderBy: { createdAt: "asc" },
    });

    const byEquipment = new Map<
      string,
      Array<{ localDate: string; setIndex: number; side: string | null; actualWeightKg: number | null; actualReps: number | null; actualSeconds: number | null; rir: number | null }>
    >();
    for (const s of sets) {
      const key = s.equipmentKey ?? "(unspecified equipment)";
      const arr = byEquipment.get(key) ?? [];
      arr.push({
        localDate: s.session.occurrence.currentDate,
        setIndex: s.setIndex,
        side: s.side,
        actualWeightKg: s.actualWeightKg,
        actualReps: s.actualReps,
        actualSeconds: s.actualSeconds,
        rir: s.rir,
      });
      byEquipment.set(key, arr);
    }

    return NextResponse.json({
      exercise: { key: def.key, name: def.name, loadBasis: def.loadBasis, repStyle: def.repStyle },
      equipmentHistories: Array.from(byEquipment.entries()).map(([equipmentKey, entries]) => ({ equipmentKey, entries })),
    });
  } catch (err) {
    return handleApiError(err);
  }
}
