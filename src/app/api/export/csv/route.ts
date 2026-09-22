import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOwnerId } from "@/lib/auth";
import { handleApiError, jsonError } from "@/lib/api";
import { toCsv } from "@/lib/csv";

export async function GET(req: NextRequest) {
  try {
    await requireOwnerId();
    const type = req.nextUrl.searchParams.get("type");

    let csv: string;
    let filename: string;

    if (type === "daily_logs") {
      const rows = await prisma.dailyLog.findMany({ orderBy: { localDate: "asc" } });
      csv = toCsv(rows, ["localDate", "weightKg", "waistCm", "calories", "proteinG", "notes"]);
      filename = "daily_logs.csv";
    } else if (type === "cardio_logs") {
      const rows = await prisma.cardioLog.findMany({ orderBy: { localDate: "asc" } });
      csv = toCsv(rows, ["localDate", "mode", "actualMinutes", "effort"]);
      filename = "cardio_logs.csv";
    } else if (type === "exercise_sets") {
      const rows = await prisma.exerciseSet.findMany({
        include: { exerciseDefinition: true, session: { include: { occurrence: true } } },
        orderBy: { createdAt: "asc" },
      });
      const flat = rows.map((r) => ({
        localDate: r.session.occurrence.currentDate,
        exercise: r.exerciseDefinition.name,
        equipmentKey: r.equipmentKey,
        setIndex: r.setIndex,
        side: r.side,
        actualWeightKg: r.actualWeightKg,
        actualReps: r.actualReps,
        actualSeconds: r.actualSeconds,
        rir: r.rir,
        status: r.status,
        painFlag: r.painFlag,
        note: r.note,
      }));
      csv = toCsv(flat, ["localDate", "exercise", "equipmentKey", "setIndex", "side", "actualWeightKg", "actualReps", "actualSeconds", "rir", "status", "painFlag", "note"]);
      filename = "exercise_sets.csv";
    } else {
      return jsonError(400, "type must be one of daily_logs, cardio_logs, exercise_sets");
    }

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
}
