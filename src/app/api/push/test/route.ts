import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOwnerId } from "@/lib/auth";
import { handleApiError, jsonError } from "@/lib/api";
import { sendWebPush } from "@/lib/push";

export async function POST() {
  try {
    await requireOwnerId();
    const subs = await prisma.pushSubscription.findMany({ where: { active: true } });
    if (subs.length === 0) return jsonError(400, "No active push subscription. Enable notifications first.");

    const outcomes = [];
    for (const sub of subs) {
      const result = await sendWebPush(sub, { title: "Compact", body: "Test notification. If you see this, push is working." });
      outcomes.push({ endpoint: sub.endpoint.slice(-12), ok: result.ok });
      if (!result.ok && result.expired) {
        await prisma.pushSubscription.update({ where: { id: sub.id }, data: { active: false, revokedAt: new Date() } });
      }
    }
    return NextResponse.json({ outcomes });
  } catch (err) {
    return handleApiError(err);
  }
}
