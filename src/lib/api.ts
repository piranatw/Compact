import { NextResponse } from "next/server";
import { AuthError } from "./auth";
import { ZodError } from "zod";

export function jsonError(status: number, message: string) {
  return NextResponse.json({ error: message }, { status });
}

export function handleApiError(err: unknown) {
  if (err instanceof AuthError) {
    return jsonError(401, "Unauthorized");
  }
  if (err instanceof ZodError) {
    return jsonError(400, err.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "));
  }
  console.error(err);
  return jsonError(500, "Internal error");
}
