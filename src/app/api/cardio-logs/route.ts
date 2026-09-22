import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireOwnerId } from "@/lib/auth";
import { handleApiError, jsonError } from "@/lib/api";
import { isValidLocalDate } from "@/lib/date";

const schema = z.object({
  occurrenceId: z.string().nullable().optional(),
  localDate: z.string(),
  mode: z.enum(["cycling", "elliptical", "other"]),
  actualMinutes: z.number().int().min(0).max(600).nullable().optional(),
  effort: z.number().int().min(1).max(10).nullable().optional(),
});

export async function POST(req: NextRequest) {
  try {
    await requireOwnerId();
    const body = schema.parse(await req.json());
    if (!isValidLocalDate(body.localDate)) return jsonError(400, "localDate must be YYYY-MM-DD");

    if (body.occurrenceId) {
      const existing = await prisma.cardioLog.findUnique({ where: { occurrenceId: body.occurrenceId } });
      if (existing) {
        const updated = await prisma.cardioLog.update({
          where: { id: existing.id },
          data: { mode: body.mode, actualMinutes: body.actualMinutes ?? null, effort: body.effort ?? null },
        });
        return NextResponse.json(updated);
      }
    }

    const created = await prisma.cardioLog.create({
      data: {
        occurrenceId: body.occurrenceId ?? null,
        localDate: body.localDate,
        mode: body.mode,
        actualMinutes: body.actualMinutes ?? null,
        effort: body.effort ?? null,
      },
    });
    return NextResponse.json(created);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function GET(req: NextRequest) {
  try {
    await requireOwnerId();
    const from = req.nextUrl.searchParams.get("from");
    const to = req.nextUrl.searchParams.get("to");
    if (!from || !to || !isValidLocalDate(from) || !isValidLocalDate(to)) {
      return jsonError(400, "from and to (YYYY-MM-DD) are required");
    }
    const logs = await prisma.cardioLog.findMany({
      where: { localDate: { gte: from, lte: to } },
      orderBy: { localDate: "asc" },
    });
    return NextResponse.json(logs);
  } catch (err) {
    return handleApiError(err);
  }
}
