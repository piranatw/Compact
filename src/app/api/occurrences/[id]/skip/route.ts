import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOwnerId } from "@/lib/auth";
import { handleApiError, jsonError } from "@/lib/api";

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requireOwnerId();
    const { id } = await ctx.params;
    const occurrence = await prisma.scheduledOccurrence.findUnique({ where: { id } });
    if (!occurrence) return jsonError(404, "Occurrence not found");
    const updated = await prisma.scheduledOccurrence.update({
      where: { id },
      data: { status: "SKIPPED" },
    });
    return NextResponse.json(updated);
  } catch (err) {
    return handleApiError(err);
  }
}
