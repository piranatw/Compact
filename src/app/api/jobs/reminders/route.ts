import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonError } from "@/lib/api";
import { todayLocalDate, localDateTimeToUTC, isoWeekday } from "@/lib/date";
import { resolveDayPlan, getOrCreateOccurrence } from "@/lib/occurrence";
import { computeRemaining } from "@/lib/remaining";
import { buildNotificationText } from "@/lib/notificationText";
import { sendWebPush } from "@/lib/push";

const CATCH_UP_WINDOW_MS = 30 * 60 * 1000;

export async function POST(req: NextRequest) {
  // Accept either a custom header (used by scripts/scheduler.ts and
  // third-party callers like cron-job.org) or Vercel Cron's own
  // `Authorization: Bearer <secret>` convention, since vercel.json crons
  // cannot set arbitrary headers.
  const headerSecret = req.headers.get("x-scheduler-secret");
  const bearer = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const providedSecret = headerSecret ?? bearer;
  if (!providedSecret || providedSecret !== process.env.SCHEDULER_SECRET) {
    return jsonError(401, "Unauthorized");
  }

  const owner = await prisma.ownerProfile.findUnique({ where: { id: "owner" } });
  if (!owner) return jsonError(404, "Owner not found");

  const now = new Date();
  const localDate = todayLocalDate(owner.timezone);
  const weekday = isoWeekday(localDate, owner.timezone);

  const rules = await prisma.reminderRule.findMany({ where: { enabled: true } });
  const results: Array<{ ruleType: string; outcome: string }> = [];

  for (const rule of rules) {
    if (!rule.activeDays.split(",").map(Number).includes(weekday)) {
      continue;
    }
    if (rule.snoozedUntil && new Date(rule.snoozedUntil) > now) {
      continue;
    }

    const scheduledFor = localDateTimeToUTC(localDate, rule.localTime, owner.timezone);
    const expiresAt = new Date(scheduledFor.getTime() + CATCH_UP_WINDOW_MS);
    const logicalKey = `${localDate}:${rule.type}`;

    if (now < scheduledFor) {
      continue; // not due yet
    }

    let outbox = await prisma.notificationOutbox.findUnique({ where: { logicalKey } });

    if (!outbox) {
      if (now > expiresAt) {
        // Missed its window entirely (e.g. after a scheduler outage): record as
        // expired directly rather than sending a stale catch-up flood.
        await prisma.notificationOutbox.create({
          data: { logicalKey, ruleType: rule.type, localDate, scheduledFor, expiresAt, status: "expired" },
        });
        results.push({ ruleType: rule.type, outcome: "expired_on_arrival" });
        continue;
      }
      try {
        outbox = await prisma.notificationOutbox.create({
          data: { logicalKey, ruleType: rule.type, localDate, scheduledFor, expiresAt, status: "processing" },
        });
      } catch {
        // Unique constraint hit: a concurrent/overlapping run already claimed this logical reminder.
        results.push({ ruleType: rule.type, outcome: "already_claimed" });
        continue;
      }
    } else if (outbox.status !== "queued" && outbox.status !== "processing") {
      results.push({ ruleType: rule.type, outcome: `already_${outbox.status}` });
      continue;
    } else if (now > expiresAt) {
      await prisma.notificationOutbox.update({ where: { id: outbox.id }, data: { status: "expired" } });
      results.push({ ruleType: rule.type, outcome: "expired" });
      continue;
    }

    // Recheck task completion right before sending.
    const plan = await resolveDayPlan(localDate);
    const occurrence = plan.hasStarted ? await getOrCreateOccurrence(localDate) : null;
    const dailyLog = await prisma.dailyLog.findUnique({ where: { localDate } });
    const remaining = occurrence
      ? computeRemaining({
          dayType: occurrence.workoutTemplate.dayType,
          cardioMandatory: occurrence.workoutTemplate.cardioMandatory,
          sessionStatus: occurrence.session?.status ?? "NOT_STARTED",
          hasCardioLog: !!occurrence.cardioLog,
          hasDailyLogNutrition: !!(dailyLog?.calories != null || dailyLog?.proteinG != null),
          hasDailyLogWeight: !!(dailyLog?.weightKg != null),
        })
      : null;

    const text = buildNotificationText({
      ruleType: rule.type,
      dayLabel: occurrence?.workoutTemplate.dayLabel ?? plan.dayLabel,
      dayType: occurrence?.workoutTemplate.dayType ?? plan.dayType,
      remaining,
      privacy: rule.privacy === "generic" ? "generic" : "detailed",
    });

    if (text.suppress) {
      await prisma.notificationOutbox.update({ where: { id: outbox.id }, data: { status: "sent" } });
      results.push({ ruleType: rule.type, outcome: "suppressed_all_done" });
      continue;
    }

    const subscriptions = await prisma.pushSubscription.findMany({ where: { active: true } });
    let anyAccepted = false;
    for (const sub of subscriptions) {
      const delivery = await prisma.notificationDelivery.upsert({
        where: { outboxId_pushSubscriptionId: { outboxId: outbox.id, pushSubscriptionId: sub.id } },
        create: { outboxId: outbox.id, pushSubscriptionId: sub.id, status: "processing" },
        update: { status: "processing" },
      });
      const result = await sendWebPush(sub, { title: text.title, body: text.body, tag: logicalKey });
      if (result.ok) {
        anyAccepted = true;
        await prisma.notificationDelivery.update({
          where: { id: delivery.id },
          data: { status: "accepted", attemptCount: { increment: 1 } },
        });
      } else {
        await prisma.notificationDelivery.update({
          where: { id: delivery.id },
          data: { status: result.expired ? "expired" : "failed", attemptCount: { increment: 1 }, lastError: result.error },
        });
        if (result.expired) {
          await prisma.pushSubscription.update({ where: { id: sub.id }, data: { active: false, revokedAt: new Date() } });
        }
      }
    }

    await prisma.notificationOutbox.update({
      where: { id: outbox.id },
      data: { status: subscriptions.length === 0 ? "failed" : anyAccepted ? "sent" : "failed", attemptCount: { increment: 1 } },
    });
    results.push({ ruleType: rule.type, outcome: subscriptions.length === 0 ? "no_subscriptions" : anyAccepted ? "sent" : "failed" });
  }

  return NextResponse.json({ localDate, ranAt: now.toISOString(), results });
}
