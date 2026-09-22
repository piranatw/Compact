import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOwnerId } from "@/lib/auth";
import { handleApiError, jsonError } from "@/lib/api";
import { isValidLocalDate, todayLocalDate, addCalendarDays } from "@/lib/date";
import { computeWeekComparison } from "@/lib/trend";

export async function GET(req: NextRequest) {
  try {
    await requireOwnerId();
    const owner = await prisma.ownerProfile.findUnique({ where: { id: "owner" } });
    if (!owner) return jsonError(404, "Owner not found");

    const dateParam = req.nextUrl.searchParams.get("date");
    const endDate = dateParam && isValidLocalDate(dateParam) ? dateParam : todayLocalDate(owner.timezone);
    const windowStart = addCalendarDays(endDate, -13);

    const logs = await prisma.dailyLog.findMany({
      where: { localDate: { gte: windowStart, lte: endDate }, weightKg: { not: null } },
      select: { localDate: true, weightKg: true },
    });
    const weightsByDate = new Map<string, number>();
    for (const l of logs) if (l.weightKg != null) weightsByDate.set(l.localDate, l.weightKg);

    const comparison = computeWeekComparison(weightsByDate, endDate);

    const milestoneReached =
      comparison.status === "ok" && owner.initialMilestoneKg != null && comparison.currentWindow.mean! <= owner.initialMilestoneKg;

    // Full series for charting (raw entries, no interpolation, no repeated values).
    const seriesFrom = addCalendarDays(endDate, -83); // ~12 weeks of history for the chart
    const series = await prisma.dailyLog.findMany({
      where: { localDate: { gte: seriesFrom, lte: endDate }, weightKg: { not: null } },
      select: { localDate: true, weightKg: true },
      orderBy: { localDate: "asc" },
    });

    return NextResponse.json({
      endDate,
      comparison,
      baseline: { weightKg: owner.baselineWeightKg, note: owner.baselineWeightNote },
      initialMilestoneKg: owner.initialMilestoneKg,
      milestoneReached,
      series,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
