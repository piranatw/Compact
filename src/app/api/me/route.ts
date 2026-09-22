import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireOwnerId, omitPasswordHash } from "@/lib/auth";
import { handleApiError } from "@/lib/api";

export async function GET() {
  try {
    const ownerId = await requireOwnerId();
    const owner = await prisma.ownerProfile.findUnique({ where: { id: ownerId } });
    if (!owner) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(omitPasswordHash(owner));
  } catch (err) {
    return handleApiError(err);
  }
}

const patchSchema = z.object({
  timezone: z.string().min(1).optional(),
  heightCm: z.number().positive().max(300).nullable().optional(),
  goalText: z.string().max(2000).nullable().optional(),
  initialMilestoneKg: z.number().positive().max(500).nullable().optional(),
  planningHorizonWeeks: z.number().int().positive().max(104).nullable().optional(),
  calorieTargetKcal: z.number().int().positive().max(10000).nullable().optional(),
  proteinTargetG: z.number().int().positive().max(1000).nullable().optional(),
  weightChangeRefLow: z.number().nullable().optional(),
  weightChangeRefHigh: z.number().nullable().optional(),
  notificationPrivacy: z.enum(["detailed", "generic"]).optional(),
  baselineWeightKg: z.number().positive().max(500).nullable().optional(),
  baselineWeightNote: z.string().max(1000).nullable().optional(),
});

export async function PATCH(req: NextRequest) {
  try {
    const ownerId = await requireOwnerId();
    const body = patchSchema.parse(await req.json());
    const owner = await prisma.ownerProfile.update({ where: { id: ownerId }, data: body });
    return NextResponse.json(omitPasswordHash(owner));
  } catch (err) {
    return handleApiError(err);
  }
}
