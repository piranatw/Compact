import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireOwnerId } from "@/lib/auth";
import { handleApiError, jsonError } from "@/lib/api";
import { isValidLocalDate } from "@/lib/date";

const schema = z.object({ toDate: z.string(), reason: z.string().max(500).optional() });

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requireOwnerId();
    const { id } = await ctx.params;
    const body = schema.parse(await req.json());
    if (!isValidLocalDate(body.toDate)) return jsonError(400, "toDate must be a valid YYYY-MM-DD date");

    const occurrence = await prisma.scheduledOccurrence.findUnique({ where: { id } });
    if (!occurrence) return jsonError(404, "Occurrence not found");

    const collision = await prisma.scheduledOccurrence.findUnique({ where: { currentDate: body.toDate } });
    if (collision && collision.id !== id) {
      return jsonError(409, `Another occurrence already exists on ${body.toDate}. Choose a different date.`);
    }

    const history = JSON.parse(occurrence.rescheduleHistory) as Array<{ from: string; to: string; at: string; reason?: string }>;
    history.push({ from: occurrence.currentDate, to: body.toDate, at: new Date().toISOString(), reason: body.reason });

    const updated = await prisma.scheduledOccurrence.update({
      where: { id },
      data: {
        currentDate: body.toDate,
        status: "RESCHEDULED",
        rescheduleHistory: JSON.stringify(history),
      },
    });
    return NextResponse.json(updated);
  } catch (err) {
    return handleApiError(err);
  }
}
