import { prisma } from "./prisma";
import { computeCycle } from "./date";

export async function getActiveProgramVersion(forLocalDate: string) {
  const versions = await prisma.programVersion.findMany({ orderBy: { versionNumber: "desc" } });
  const applicable = versions.find((v) => v.effectiveDate === "1970-01-01" || v.effectiveDate <= forLocalDate);
  return applicable ?? versions[0] ?? null;
}

export interface DayPlanInfo {
  hasStarted: boolean;
  daysUntilStart?: number;
  dayNumber: number;
  weekNumber: number;
  templateId: string | null;
  dayLabel: string | null;
  dayType: string | null;
}

export async function resolveDayPlan(localDate: string): Promise<DayPlanInfo> {
  const owner = await prisma.ownerProfile.findUnique({ where: { id: "owner" } });
  if (!owner?.programStartDate) {
    return { hasStarted: false, dayNumber: 0, weekNumber: 0, templateId: null, dayLabel: null, dayType: null };
  }
  const cycle = computeCycle(owner.programStartDate, localDate);
  if (!cycle.hasStarted) {
    return {
      hasStarted: false,
      daysUntilStart: cycle.daysUntilStart,
      dayNumber: 0,
      weekNumber: 0,
      templateId: null,
      dayLabel: null,
      dayType: null,
    };
  }
  const version = await getActiveProgramVersion(localDate);
  if (!version) {
    return { hasStarted: true, dayNumber: cycle.dayNumber, weekNumber: cycle.weekNumber, templateId: null, dayLabel: null, dayType: null };
  }
  const template = await prisma.workoutTemplate.findUnique({
    where: { programVersionId_dayNumber: { programVersionId: version.id, dayNumber: cycle.dayNumber } },
  });
  return {
    hasStarted: true,
    dayNumber: cycle.dayNumber,
    weekNumber: cycle.weekNumber,
    templateId: template?.id ?? null,
    dayLabel: template?.dayLabel ?? null,
    dayType: template?.dayType ?? null,
  };
}

// Ensures a persistent ScheduledOccurrence row exists for this local date, using
// the program's day-of-cycle mapping. Returns null if the program hasn't started
// yet, or the resolved day is a rest/no-template day (still may return an
// occurrence for REST/OPTIONAL_RECOVERY so it can be inspected/skipped explicitly).
export async function getOrCreateOccurrence(localDate: string) {
  const existing = await prisma.scheduledOccurrence.findUnique({
    where: { currentDate: localDate },
    include: { workoutTemplate: { include: { templateExercises: { include: { exerciseDefinition: true }, orderBy: { orderIndex: "asc" } } } }, session: true, cardioLog: true },
  });
  if (existing) return existing;

  const plan = await resolveDayPlan(localDate);
  if (!plan.hasStarted || !plan.templateId) return null;

  const version = await getActiveProgramVersion(localDate);
  if (!version) return null;

  const created = await prisma.scheduledOccurrence.create({
    data: {
      programVersionId: version.id,
      workoutTemplateId: plan.templateId,
      originalDate: localDate,
      currentDate: localDate,
      status: "SCHEDULED",
    },
    include: { workoutTemplate: { include: { templateExercises: { include: { exerciseDefinition: true }, orderBy: { orderIndex: "asc" } } } }, session: true, cardioLog: true },
  });
  return created;
}
