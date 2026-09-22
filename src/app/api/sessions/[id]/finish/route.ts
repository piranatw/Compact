import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireOwnerId } from "@/lib/auth";
import { handleApiError, jsonError } from "@/lib/api";

const schema = z.object({ notes: z.string().max(2000).nullable().optional() });

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requireOwnerId();
    const { id } = await ctx.params;
    const body = schema.parse(await req.json());

    const session = await prisma.workoutSession.findUnique({
      where: { id },
      include: {
        sets: true,
        occurrence: { include: { workoutTemplate: { include: { templateExercises: true } } } },
      },
    });
    if (!session) return jsonError(404, "Session not found");

    let fullyComplete = true;
    for (const te of session.occurrence.workoutTemplate.templateExercises) {
      const completedCount = session.sets.filter(
        (s) => s.exerciseDefinitionId === te.exerciseDefinitionId && !s.isWarmup && s.status === "completed"
      ).length;
      if (completedCount < te.workingSets) {
        fullyComplete = false;
        break;
      }
    }

    const updated = await prisma.workoutSession.update({
      where: { id },
      data: {
        status: fullyComplete ? "COMPLETED" : "PARTIAL",
        finishedAt: new Date(),
        notes: body.notes ?? session.notes,
        version: { increment: 1 },
      },
    });

    return NextResponse.json(updated);
  } catch (err) {
    return handleApiError(err);
  }
}
