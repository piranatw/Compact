import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { createSession } from "@/lib/auth";
import { handleApiError, jsonError } from "@/lib/api";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(req: NextRequest) {
  try {
    const body = schema.parse(await req.json());
    const owner = await prisma.ownerProfile.findUnique({ where: { id: "owner" } });
    if (!owner || owner.email.toLowerCase() !== body.email.toLowerCase()) {
      return jsonError(401, "Invalid email or password");
    }
    const ok = await bcrypt.compare(body.password, owner.passwordHash);
    if (!ok) {
      return jsonError(401, "Invalid email or password");
    }
    await createSession(owner.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
