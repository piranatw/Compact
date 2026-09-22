import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireOwnerId } from "@/lib/auth";
import { handleApiError, jsonError } from "@/lib/api";

const schema = z.object({ confirmationPhrase: z.string() });
const REQUIRED_PHRASE = "DELETE MY DATA";

// Explicit, confirmed reset: clears logs, sessions, occurrences, and active
// reminders/subscriptions. The owner account itself is kept so sign-in still
// works, but programStartDate is cleared so first-run setup runs again.
export async function POST(req: NextRequest) {
  try {
    const ownerId = await requireOwnerId();
    const body = schema.parse(await req.json());
    if (body.confirmationPhrase !== REQUIRED_PHRASE) {
      return jsonError(400, `Type "${REQUIRED_PHRASE}" exactly to confirm.`);
    }

    await prisma.$transaction([
      prisma.notificationDelivery.deleteMany({}),
      prisma.notificationOutbox.deleteMany({}),
      prisma.pushSubscription.deleteMany({}),
      prisma.reminderRule.updateMany({ data: { enabled: false, snoozedUntil: null } }),
      prisma.exerciseSet.deleteMany({}),
      prisma.cardioLog.deleteMany({}),
      prisma.workoutSession.deleteMany({}),
      prisma.scheduledOccurrence.deleteMany({}),
      prisma.dailyLog.deleteMany({}),
      prisma.ownerProfile.update({ where: { id: ownerId }, data: { programStartDate: null } }),
    ]);

    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
