import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

const COOKIE_NAME = "athletic_log_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days

function secretKey() {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error("SESSION_SECRET is not configured");
  }
  return new TextEncoder().encode(secret);
}

export async function createSession(ownerId: string) {
  const token = await new SignJWT({ sub: ownerId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(secretKey());

  const store = await cookies();
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

export async function destroySession() {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

export async function getSessionOwnerId(): Promise<string | null> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey());
    return typeof payload.sub === "string" ? payload.sub : null;
  } catch {
    return null;
  }
}

export async function requireOwnerId(): Promise<string> {
  const id = await getSessionOwnerId();
  if (!id) {
    throw new AuthError();
  }
  return id;
}

export class AuthError extends Error {
  constructor() {
    super("Unauthorized");
  }
}

export function omitPasswordHash<T extends { passwordHash: string }>(owner: T): Omit<T, "passwordHash"> {
  const clone: Record<string, unknown> = { ...owner };
  delete clone.passwordHash;
  return clone as Omit<T, "passwordHash">;
}
