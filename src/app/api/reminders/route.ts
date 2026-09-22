import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireOwnerId } from "@/lib/auth";
import { handleApiError, jsonError } from "@/lib/api";

export async function GET() {
  try {
    await requireOwnerId();
    const rules = await prisma.reminderRule.findMany();
    return NextResponse.json(rules);
  } catch (err) {
    return handleApiError(err);
  }
}

const schema = z.object({
  id: z.string(),
  localTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  activeDays: z.string().optional(),
  enabled: z.boolean().optional(),
  privacy: z.enum(["detailed", "generic"]).optional(),
});

export async function PUT(req: NextRequest) {
  try {
    await requireOwnerId();
    const body = schema.parse(await req.json());
    const existing = await prisma.reminderRule.findUnique({ where: { id: body.id } });
    if (!existing) return jsonError(404, "Reminder rule not found");
    const { id, ...rest } = body;
    const updated = await prisma.reminderRule.update({ where: { id }, data: rest });
    return NextResponse.json(updated);
  } catch (err) {
    return handleApiError(err);
  }
}
