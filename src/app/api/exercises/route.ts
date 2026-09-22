import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOwnerId } from "@/lib/auth";
import { handleApiError } from "@/lib/api";

export async function GET() {
  try {
    await requireOwnerId();
    const exercises = await prisma.exerciseDefinition.findMany({ orderBy: { name: "asc" } });
    return NextResponse.json(exercises);
  } catch (err) {
    return handleApiError(err);
  }
}
