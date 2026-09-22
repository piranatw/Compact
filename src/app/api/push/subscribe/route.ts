import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireOwnerId } from "@/lib/auth";
import { handleApiError } from "@/lib/api";

export async function GET() {
  try {
    await requireOwnerId();
    const subs = await prisma.pushSubscription.findMany({ where: { active: true }, orderBy: { createdAt: "desc" } });
    return NextResponse.json(subs.map((s) => ({ id: s.id, endpointTail: s.endpoint.slice(-16), createdAt: s.createdAt })));
  } catch (err) {
    return handleApiError(err);
  }
}

const schema = z.object({
  endpoint: z.string().url(),
  keys: z.object({ p256dh: z.string(), auth: z.string() }),
});

export async function POST(req: NextRequest) {
  try {
    await requireOwnerId();
    const body = schema.parse(await req.json());
    const sub = await prisma.pushSubscription.upsert({
      where: { endpoint: body.endpoint },
      create: { endpoint: body.endpoint, p256dh: body.keys.p256dh, auth: body.keys.auth, active: true },
      update: { p256dh: body.keys.p256dh, auth: body.keys.auth, active: true, revokedAt: null },
    });
    return NextResponse.json(sub);
  } catch (err) {
    return handleApiError(err);
  }
}

const deleteSchema = z.object({ endpoint: z.string().url() });

export async function DELETE(req: NextRequest) {
  try {
    await requireOwnerId();
    const body = deleteSchema.parse(await req.json());
    await prisma.pushSubscription.updateMany({
      where: { endpoint: body.endpoint },
      data: { active: false, revokedAt: new Date() },
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
