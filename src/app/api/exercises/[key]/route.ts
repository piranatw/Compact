import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireOwnerId } from "@/lib/auth";
import { handleApiError, jsonError } from "@/lib/api";

const schema = z.object({
  equipmentLabel: z.string().max(200).nullable().optional(),
  defaultIncrementKg: z.number().positive().max(100).nullable().optional(),
});

export async function PATCH(req: Request, ctx: { params: Promise<{ key: string }> }) {
  try {
    await requireOwnerId();
    const { key } = await ctx.params;
    const body = schema.parse(await req.json());
    const existing = await prisma.exerciseDefinition.findUnique({ where: { key } });
    if (!existing) return jsonError(404, "Unknown exercise key");
    const updated = await prisma.exerciseDefinition.update({ where: { key }, data: body });
    return NextResponse.json(updated);
  } catch (err) {
    return handleApiError(err);
  }
}
