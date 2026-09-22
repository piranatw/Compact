import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireOwnerId } from "@/lib/auth";
import { handleApiError, jsonError } from "@/lib/api";
import { isValidLocalDate } from "@/lib/date";

const schema = z.object({
  programStartDate: z.string(),
});

export async function POST(req: NextRequest) {
  try {
    const ownerId = await requireOwnerId();
    const body = schema.parse(await req.json());
    if (!isValidLocalDate(body.programStartDate)) {
      return jsonError(400, "programStartDate must be a valid YYYY-MM-DD date");
    }
    const owner = await prisma.ownerProfile.update({
      where: { id: ownerId },
      data: { programStartDate: body.programStartDate },
    });
    return NextResponse.json({ programStartDate: owner.programStartDate });
  } catch (err) {
    return handleApiError(err);
  }
}
