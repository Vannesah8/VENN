import { createHash, randomBytes } from "node:crypto";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import type { EscrowActor, EscrowRole } from "@/lib/escrow";
import { getDatabase, type Db } from "@/lib/db";

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

export function createSessionRecord(
  userId: string,
  db: Db = getDatabase(),
): { token: string; expiresAt: Date } {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

  db.prepare(
    "INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)",
  ).run(hashToken(token), userId, new Date().toISOString(), expiresAt.toISOString());

  return { token, expiresAt };
}

export function getUserBySessionToken(
  token: string,
  db: Db = getDatabase(),
): EscrowActor | null {
  const hash = hashToken(token);
  const row = db
    .prepare(
      `SELECT s.user_id, u.display_name, u.role, s.expires_at
       FROM sessions s
       JOIN users u ON u.id = s.user_id
       WHERE s.token_hash = ?`,
    )
    .get(hash) as SessionRow | undefined;

  if (!row) {
    return null;
  }

  if (new Date(row.expires_at).getTime() < Date.now()) {
    db.prepare("DELETE FROM sessions WHERE token_hash = ?").run(hash);
    return null;
  }

  return { id: row.user_id, displayName: row.display_name, role: row.role };
}

export function deleteSessionByToken(token: string, db: Db = getDatabase()): void {
  db.prepare("DELETE FROM sessions WHERE token_hash = ?").run(hashToken(token));
}

export async function createSession(userId: string): Promise<void> {
  const { token, expiresAt } = createSessionRecord(userId);
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
    deleteSessionByToken(token);
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