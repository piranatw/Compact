import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOwnerId, omitPasswordHash } from "@/lib/auth";
import { handleApiError } from "@/lib/api";

export async function GET() {
  try {
    const ownerId = await requireOwnerId();
    const [owner, dailyLogs, cardioLogs, sessions, sets, occurrences] = await Promise.all([
      prisma.ownerProfile.findUnique({ where: { id: ownerId } }),
      prisma.dailyLog.findMany({ orderBy: { localDate: "asc" } }),
      prisma.cardioLog.findMany({ orderBy: { localDate: "asc" } }),
      prisma.workoutSession.findMany({ orderBy: { startedAt: "asc" } }),
      prisma.exerciseSet.findMany({ orderBy: { createdAt: "asc" } }),
      prisma.scheduledOccurrence.findMany({ orderBy: { originalDate: "asc" } }),
    ]);

    return NextResponse.json({
      schema: "athletic-log.export.v1",
      exportedAt: new Date().toISOString(),
      owner: owner ? omitPasswordHash(owner) : null,
      dailyLogs,
      cardioLogs,
      workoutSessions: sessions,
      exerciseSets: sets,
      scheduledOccurrences: occurrences,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
