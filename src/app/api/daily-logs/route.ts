import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireOwnerId } from "@/lib/auth";
import { handleApiError, jsonError } from "@/lib/api";
import { isValidLocalDate } from "@/lib/date";

export async function GET(req: NextRequest) {
  try {
    await requireOwnerId();
    const date = req.nextUrl.searchParams.get("date");
    const from = req.nextUrl.searchParams.get("from");
    const to = req.nextUrl.searchParams.get("to");

    if (date) {
      if (!isValidLocalDate(date)) return jsonError(400, "date must be YYYY-MM-DD");
      const log = await prisma.dailyLog.findUnique({ where: { localDate: date } });
      return NextResponse.json(log);
    }
    if (from && to) {
      if (!isValidLocalDate(from) || !isValidLocalDate(to)) return jsonError(400, "from/to must be YYYY-MM-DD");
      const logs = await prisma.dailyLog.findMany({
        where: { localDate: { gte: from, lte: to } },
        orderBy: { localDate: "asc" },
      });
      return NextResponse.json(logs);
    }
    return jsonError(400, "Provide either date or from+to");
  } catch (err) {
    return handleApiError(err);
  }
}

const schema = z.object({
  localDate: z.string(),
  weightKg: z.number().positive().max(500).nullable().optional(),
  waistCm: z.number().positive().max(300).nullable().optional(),
  calories: z.number().int().min(0).max(20000).nullable().optional(),
  proteinG: z.number().int().min(0).max(2000).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
});

export async function POST(req: NextRequest) {
  try {
    await requireOwnerId();
    const body = schema.parse(await req.json());
    if (!isValidLocalDate(body.localDate)) return jsonError(400, "localDate must be YYYY-MM-DD");

    const { localDate, ...rest } = body;
    const log = await prisma.dailyLog.upsert({
      where: { localDate },
      create: { localDate, ...rest },
      update: rest,
    });
    return NextResponse.json(log);
  } catch (err) {
    return handleApiError(err);
  }
}
