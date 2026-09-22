import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOwnerId } from "@/lib/auth";
import { handleApiError, jsonError } from "@/lib/api";
import { todayLocalDate, isValidLocalDate } from "@/lib/date";
import { getOrCreateOccurrence, resolveDayPlan } from "@/lib/occurrence";
import { computeRemaining } from "@/lib/remaining";

export async function GET(req: NextRequest) {
  try {
    const ownerId = await requireOwnerId();
    const owner = await prisma.ownerProfile.findUnique({ where: { id: ownerId } });
    if (!owner) return jsonError(404, "Owner not found");

    const dateParam = req.nextUrl.searchParams.get("date");
    const localDate = dateParam && isValidLocalDate(dateParam) ? dateParam : todayLocalDate(owner.timezone);

    const plan = await resolveDayPlan(localDate);
    if (!plan.hasStarted) {
      return NextResponse.json({
        localDate,
        started: false,
        daysUntilStart: plan.daysUntilStart,
        programStartDate: owner.programStartDate,
      });
    }

    const occurrence = await getOrCreateOccurrence(localDate);
    const dailyLog = await prisma.dailyLog.findUnique({ where: { localDate } });

    const latestWeightLog = await prisma.dailyLog.findFirst({
      where: { weightKg: { not: null } },
      orderBy: { localDate: "desc" },
    });

    const remaining = computeRemaining({
      dayType: occurrence?.workoutTemplate.dayType ?? null,
      cardioMandatory: occurrence?.workoutTemplate.cardioMandatory ?? false,
      sessionStatus: occurrence?.session?.status ?? (occurrence?.workoutTemplate.dayType === "STRENGTH" ? "NOT_STARTED" : null),
      hasCardioLog: !!occurrence?.cardioLog,
      hasDailyLogNutrition: !!(dailyLog?.calories != null || dailyLog?.proteinG != null),
      hasDailyLogWeight: !!(dailyLog?.weightKg != null),
    });

    return NextResponse.json({
      localDate,
      started: true,
      weekNumber: plan.weekNumber,
      dayNumber: plan.dayNumber,
      dayLabel: occurrence?.workoutTemplate.dayLabel ?? plan.dayLabel,
      dayType: occurrence?.workoutTemplate.dayType ?? plan.dayType,
      occurrence: occurrence
        ? {
            id: occurrence.id,
            status: occurrence.status,
            originalDate: occurrence.originalDate,
            currentDate: occurrence.currentDate,
            plannedCardioMinutesLow: occurrence.workoutTemplate.plannedCardioMinutesLow,
            plannedCardioMinutesHigh: occurrence.workoutTemplate.plannedCardioMinutesHigh,
            cardioMandatory: occurrence.workoutTemplate.cardioMandatory,
            exerciseCount: occurrence.workoutTemplate.templateExercises.length,
            session: occurrence.session
              ? { id: occurrence.session.id, status: occurrence.session.status }
              : null,
            cardioLog: occurrence.cardioLog,
          }
        : null,
      dailyLog,
      latestWeight: latestWeightLog ? { weightKg: latestWeightLog.weightKg, localDate: latestWeightLog.localDate } : null,
      baseline: { weightKg: owner.baselineWeightKg, note: owner.baselineWeightNote },
      calorieTargetKcal: owner.calorieTargetKcal,
      proteinTargetG: owner.proteinTargetG,
      remaining,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
