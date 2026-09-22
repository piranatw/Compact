import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireOwnerId } from "@/lib/auth";
import { handleApiError, jsonError } from "@/lib/api";

const schema = z.object({
  clientId: z.string().min(1),
  exerciseDefinitionId: z.string(),
  setIndex: z.number().int().min(1),
  side: z.enum(["left", "right"]).nullable().optional(),
  equipmentKey: z.string().max(200).nullable().optional(),
  actualWeightKg: z.number().min(0).max(1000).nullable().optional(),
  actualReps: z.number().int().min(0).max(1000).nullable().optional(),
  actualSeconds: z.number().int().min(0).max(36000).nullable().optional(),
  rir: z.number().int().min(0).max(10).nullable().optional(),
  isWarmup: z.boolean().optional(),
  status: z.enum(["planned", "completed", "skipped"]).optional(),
  painFlag: z.boolean().optional(),
  note: z.string().max(1000).nullable().optional(),
});

// Idempotent upsert keyed by a client-generated clientId, so retries after a
// dropped connection never create duplicate sets.
export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requireOwnerId();
    const { id: sessionId } = await ctx.params;
    const body = schema.parse(await req.json());

    const session = await prisma.workoutSession.findUnique({ where: { id: sessionId } });
    if (!session) return jsonError(404, "Session not found");

    const data = {
      sessionId,
      exerciseDefinitionId: body.exerciseDefinitionId,
      setIndex: body.setIndex,
      side: body.side ?? null,
      equipmentKey: body.equipmentKey ?? null,
      actualWeightKg: body.actualWeightKg ?? null,
      actualReps: body.actualReps ?? null,
      actualSeconds: body.actualSeconds ?? null,
      rir: body.rir ?? null,
      isWarmup: body.isWarmup ?? false,
      status: body.status ?? "planned",
      painFlag: body.painFlag ?? false,
      note: body.note ?? null,
    };

    const set = await prisma.exerciseSet.upsert({
      where: { clientId: body.clientId },
      create: { clientId: body.clientId, ...data },
      update: data,
    });

    return NextResponse.json(set);
  } catch (err) {
    return handleApiError(err);
  }
}
