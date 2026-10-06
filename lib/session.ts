import { createHash, randomBytes } from "node:crypto";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import type { EscrowActor, EscrowRole } from "@/lib/escrow";
import { getDatabase, type DbLike } from "@/lib/db";

export const SESSION_COOKIE = "venn_session";

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

interface SessionRow {
  user_id: string;
  display_name: string;
  role: EscrowRole;
  expires_at: string;
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function createSessionRecord(
  userId: string,
  db: DbLike = getDatabase(),
): Promise<{ token: string; expiresAt: Date }> {
  const d = await db;
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

  await d.run(
    "INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)",
    [hashToken(token), userId, new Date().toISOString(), expiresAt.toISOString()],
  );

  return { token, expiresAt };
}

export async function getUserBySessionToken(
  token: string,
  db: DbLike = getDatabase(),
): Promise<EscrowActor | null> {
  const d = await db;
  const hash = hashToken(token);
  const row = await d.get<SessionRow>(
    `SELECT s.user_id, u.display_name, u.role, s.expires_at
     FROM sessions s
     JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = ?`,
    [hash],
  );

  if (!row) {
    return null;
  }

  if (new Date(row.expires_at).getTime() < Date.now()) {
    await d.run("DELETE FROM sessions WHERE token_hash = ?", [hash]);
    return null;
  }

  return { id: row.user_id, displayName: row.display_name, role: row.role };
}

export async function deleteSessionByToken(
  token: string,
  db: DbLike = getDatabase(),
): Promise<void> {
  const d = await db;
  await d.run("DELETE FROM sessions WHERE token_hash = ?", [hashToken(token)]);
}

export async function createSession(userId: string): Promise<void> {
  const { token, expiresAt } = await createSessionRecord(userId);
  const cookieStore = await cookies();

  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
    expires: expiresAt,
  });
}

export async function getCurrentActor(): Promise<EscrowActor | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;

  if (!token) {
    return null;
  }

  return getUserBySessionToken(token);
}

export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;

  if (token) {
    await deleteSessionByToken(token);
  }

  cookieStore.delete(SESSION_COOKIE);
}

export async function requireActor(): Promise<EscrowActor> {
  const actor = await getCurrentActor();

  if (!actor) {
    redirect("/login");
  }

  return actor;
}