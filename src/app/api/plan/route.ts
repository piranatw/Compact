import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOwnerId } from "@/lib/auth";
import { handleApiError, jsonError } from "@/lib/api";
import { addCalendarDays, isValidLocalDate, todayLocalDate, calendarDaysBetween } from "@/lib/date";
import { getOrCreateOccurrence, resolveDayPlan } from "@/lib/occurrence";

const MAX_RANGE_DAYS = 45;

export async function GET(req: NextRequest) {
  try {
    await requireOwnerId();
    const owner = await prisma.ownerProfile.findUnique({ where: { id: "owner" } });
    if (!owner) return jsonError(404, "Owner not found");

    const today = todayLocalDate(owner.timezone);
    const fromParam = req.nextUrl.searchParams.get("from");
    const toParam = req.nextUrl.searchParams.get("to");
    const from = fromParam && isValidLocalDate(fromParam) ? fromParam : addCalendarDays(today, -3);
    const to = toParam && isValidLocalDate(toParam) ? toParam : addCalendarDays(today, 10);

    const span = calendarDaysBetween(from, to);
    if (span < 0 || span > MAX_RANGE_DAYS) {
      return jsonError(400, `Range must be non-negative and at most ${MAX_RANGE_DAYS} days`);
    }

    const days = [];
    for (let i = 0; i <= span; i++) {
      const localDate = addCalendarDays(from, i);
      const plan = await resolveDayPlan(localDate);
      if (!plan.hasStarted) {
        days.push({ localDate, started: false });
        continue;
      }
      const isDueOrPast = calendarDaysBetween(localDate, today) >= 0;
      const occurrence = isDueOrPast
        ? await getOrCreateOccurrence(localDate)
        : await prisma.scheduledOccurrence.findUnique({
            where: { currentDate: localDate },
            include: { workoutTemplate: { include: { templateExercises: { include: { exerciseDefinition: true }, orderBy: { orderIndex: "asc" } } } }, session: true, cardioLog: true },
          });

      days.push({
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
              sessionStatus: occurrence.session?.status ?? null,
              exercises: occurrence.workoutTemplate.templateExercises.map((te) => ({
                name: te.exerciseDefinition.name,
                workingSets: te.workingSets,
                targetRepsLow: te.targetRepsLow,
                targetRepsHigh: te.targetRepsHigh,
                targetSecondsLow: te.targetSecondsLow,
                targetSecondsHigh: te.targetSecondsHigh,
              })),
              plannedCardioMinutesLow: occurrence.workoutTemplate.plannedCardioMinutesLow,
              plannedCardioMinutesHigh: occurrence.workoutTemplate.plannedCardioMinutesHigh,
            }
          : null,
      });
    }

    return NextResponse.json({ from, to, today, days });
  } catch (err) {
    return handleApiError(err);
  }
}
