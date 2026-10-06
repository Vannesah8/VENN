import { createHash, randomInt } from "node:crypto";

import { getDatabase, type DbLike } from "@/lib/db";
import { isSmsDemo, getSmsProvider } from "@/lib/notifications";

export type OtpPurpose = "login" | "register";

export interface IssueOtpResult {
  /** Present only in demo mode, so the fake SMS can be surfaced in the UI. */
  demoCode?: string;
  expiresInMs: number;
}

const CODE_TTL_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const PHONE_PATTERN = /^\+?[0-9]{9,15}$/;

export function normalizePhone(raw: string): string {
  const phone = raw.trim().replace(/[\s\-()]/g, "");

  if (!phone) {
    return "";
  }

  if (phone.startsWith("0")) {
    return `+254${phone.slice(1)}`;
  }

  if (phone.startsWith("+")) {
    return phone;
  }

  return `+${phone}`;
}

function isValidPhone(phone: string): boolean {
  return PHONE_PATTERN.test(phone) && phone.replace(/^\+/, "").length >= 9;
}

function hashCode(code: string): string {
  return createHash("sha256").update(code).digest("hex");
}

export function generateCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

export async function issueOtp(
  phone: string,
  purpose: OtpPurpose,
  db: DbLike = getDatabase(),
): Promise<IssueOtpResult> {
  const d = await db;
  const normalized = normalizePhone(phone);

  if (!isValidPhone(normalized)) {
    throw new Error("Enter a valid phone number");
  }

  const existing = await d.get<{ id: number }>(
    "SELECT id FROM otp_codes WHERE phone = ? AND purpose = ? AND used_at IS NULL ORDER BY id DESC LIMIT 1",
    [normalized, purpose],
  );

  if (existing) {
    await d.run("UPDATE otp_codes SET used_at = ? WHERE id = ?", [
      new Date().toISOString(),
      existing.id,
    ]);
  }

  const code = generateCode();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + CODE_TTL_MS);

  await d.run(
    "INSERT INTO otp_codes (phone, purpose, code_hash, attempts, expires_at) VALUES (?, ?, ?, 0, ?)",
    [normalized, purpose, hashCode(code), expiresAt.toISOString()],
  );

  const sms = getSmsProvider();
  await sms.sendSms(normalized, `Venn verification code: ${code}`);

  return {
    demoCode: isSmsDemo() ? code : undefined,
    expiresInMs: CODE_TTL_MS,
  };
}

export async function verifyOtp(
  phone: string,
  code: string,
  purpose: OtpPurpose,
  db: DbLike = getDatabase(),
): Promise<boolean> {
  const d = await db;
  const normalized = normalizePhone(phone);
  const trimmed = code.trim();

  if (!trimmed || trimmed.length > 8) {
    return false;
  }

  const row = await d.get<{
    id: number;
    code_hash: string;
    attempts: number;
    expires_at: string;
  }>(
    "SELECT id, code_hash, attempts, expires_at FROM otp_codes WHERE phone = ? AND purpose = ? AND used_at IS NULL ORDER BY id DESC LIMIT 1",
    [normalized, purpose],
  );

  if (!row) {
    return false;
  }

  if (row.attempts >= MAX_ATTEMPTS) {
    return false;
  }

  if (new Date(row.expires_at).getTime() < Date.now()) {
    return false;
  }

  const candidate = createHash("sha256").update(trimmed).digest("hex");

  if (candidate !== row.code_hash) {
    await d.run("UPDATE otp_codes SET attempts = attempts + 1 WHERE id = ?", [row.id]);
    return false;
  }

  await d.run("UPDATE otp_codes SET used_at = ? WHERE id = ?", [
    new Date().toISOString(),
    row.id,
  ]);

  return true;
}