import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOwnerId } from "@/lib/auth";
import { handleApiError, jsonError } from "@/lib/api";
import { getLastComparableSession } from "@/lib/history";
import { computeProgression } from "@/lib/progression";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requireOwnerId();
    const { id } = await ctx.params;

    const session = await prisma.workoutSession.findUnique({
      where: { id },
      include: {
        sets: true,
        occurrence: {
          include: {
            workoutTemplate: {
              include: { templateExercises: { include: { exerciseDefinition: true }, orderBy: { orderIndex: "asc" } } },
            },
          },
        },
      },
    });
    if (!session) return jsonError(404, "Session not found");

    const exercises = await Promise.all(
      session.occurrence.workoutTemplate.templateExercises.map(async (te) => {
        const lastComparable = await getLastComparableSession(te.exerciseDefinitionId, session.id);
        const progression = computeProgression({
          workingSets: te.workingSets,
          targetRepsHigh: te.targetRepsHigh,
          defaultIncrementKg: te.exerciseDefinition.defaultIncrementKg,
          lastComparable,
        });
        return {
          templateExerciseId: te.id,
          exerciseDefinitionId: te.exerciseDefinitionId,
          name: te.exerciseDefinition.name,
          loadBasis: te.exerciseDefinition.loadBasis,
          repStyle: te.exerciseDefinition.repStyle,
          cues: te.exerciseDefinition.cues,
          equipmentLabel: te.exerciseDefinition.equipmentLabel,
          orderIndex: te.orderIndex,
          workingSets: te.workingSets,
          targetRepsLow: te.targetRepsLow,
          targetRepsHigh: te.targetRepsHigh,
          targetSecondsLow: te.targetSecondsLow,
          targetSecondsHigh: te.targetSecondsHigh,
          restSeconds: te.restSeconds,
          loggedSets: session.sets.filter((s) => s.exerciseDefinitionId === te.exerciseDefinitionId),
          lastComparable,
          progression,
        };
      })
    );

    return NextResponse.json({
      session: { id: session.id, status: session.status, startedAt: session.startedAt, finishedAt: session.finishedAt, notes: session.notes },
      occurrence: {
        id: session.occurrence.id,
        currentDate: session.occurrence.currentDate,
        dayLabel: session.occurrence.workoutTemplate.dayLabel,
      },
      exercises,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
