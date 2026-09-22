import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireOwnerId } from "@/lib/auth";
import { handleApiError, jsonError } from "@/lib/api";

const schema = z.object({ occurrenceId: z.string() });

// Start or resume a session for an occurrence. Idempotent: calling twice for
// the same occurrence returns the same session rather than creating a second one.
export async function POST(req: NextRequest) {
  try {
    await requireOwnerId();
    const body = schema.parse(await req.json());

    const occurrence = await prisma.scheduledOccurrence.findUnique({ where: { id: body.occurrenceId } });
    if (!occurrence) return jsonError(404, "Occurrence not found");

    const existing = await prisma.workoutSession.findUnique({ where: { occurrenceId: occurrence.id } });
    if (existing) {
      if (existing.status === "NOT_STARTED") {
        const updated = await prisma.workoutSession.update({
          where: { id: existing.id },
          data: { status: "IN_PROGRESS", startedAt: existing.startedAt ?? new Date() },
        });
        return NextResponse.json(updated);
      }
      return NextResponse.json(existing);
    }

    const created = await prisma.workoutSession.create({
      data: { occurrenceId: occurrence.id, status: "IN_PROGRESS", startedAt: new Date() },
    });
    return NextResponse.json(created);
  } catch (err) {
    return handleApiError(err);
  }
}
