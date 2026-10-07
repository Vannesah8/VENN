"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { IDLE_ACTION_STATE, type ActionState } from "@/lib/action-state";
import { hashPassword, verifyPassword } from "@/lib/auth";
import {
  type EscrowAction,
  type EscrowActionPayload,
  type EscrowRole,
  EscrowError,
  isEscrowAction,
} from "@/lib/escrow";
import { isLang, isCurrency } from "@/lib/i18n";
import { parseAmountToCents } from "@/lib/money";
import { processNotifications } from "@/lib/notifications";
import { issueOtp, normalizePhone, verifyOtp } from "@/lib/otp";
import {
  createPaymentIntent,
  settlePaymentIntent,
} from "@/lib/payments";
import { setPrefsCookie } from "@/lib/prefs";
import { withdrawFromWallet } from "@/lib/ledger";
import { consumeRateLimit, rateLimitError, type RateLimitResult } from "@/lib/rate-limit";
import { createSession, destroySession, requireActor } from "@/lib/session";
import {
  applyActionToTransaction,
  createTransaction,
  createUserId,
  createUser,
  depositWalletFunds,
  getUserByEmail,
  getUserByPhone,
  updateUserPrefs,
} from "@/lib/transactions";

const AUTH_ROLES: readonly EscrowRole[] = ["buyer", "seller"];
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function toActionState(error: unknown): ActionState {
  if (error instanceof EscrowError) {
    return { error: error.message, status: error.code };
  }

  return {
    error: error instanceof Error ? error.message : "Something went wrong",
    status: null,
  };
}

export async function loginUser(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  const limit = await consumeRateLimit(email, { limit: 10, windowMs: 15 * 60 * 1000 });
  if (!limit.allowed) {
    return (await deniedState(limit))!;
  }

  const user = await getUserByEmail(email);

  if (!user || !user.passwordHash || !verifyPassword(password, user.passwordHash)) {
    return { error: "Invalid email or password", status: "invalid_credentials" };
  }

  await createSession(user.id);
  revalidatePath("/", "layout");
  redirect("/dashboard");
}

export async function sendOtpLogin(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState & { demoCode?: string }> {
  const phone = normalizePhone(String(formData.get("phone") ?? ""));

  const limit = await consumeRateLimit(phone, { limit: 5, windowMs: 15 * 60 * 1000 });
  if (!limit.allowed) {
    return (await deniedState(limit))!;
  }

  try {
    const result = await issueOtp(phone, "login");
    if (result.demoCode) {
      console.log(`[sms:demo] Sending login code ${result.demoCode} to ${phone}`);
    }

    return { error: null, status: "otp_sent", demoCode: result.demoCode };
  } catch (error) {
    return toActionState(error);
  }
}

async function deniedState(limit: RateLimitResult): Promise<ActionState | null> {
  return rateLimitError(limit.allowed, limit.retryAfterMs);
}

export async function otpLogin(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const phone = normalizePhone(String(formData.get("phone") ?? ""));
  const code = String(formData.get("code") ?? "");

  const ok = await verifyOtp(phone, code, "login");

  if (!ok) {
    return { error: "That code is invalid or has expired", status: "invalid_credentials" };
  }

  let user = await getUserByPhone(phone);

  if (!user) {
    const last4 = phone.slice(-4);
    user = await createUser({
      id: createUserId(),
      displayName: `Phone user  ••${last4}`,
      role: "buyer",
      email: `phone-${last4}-${phone.length}@venn.demo`,
      passwordHash: null,
      phone,
      lang: "en",
      currency: "KES",
    });
  }

  await createSession(user.id);
  revalidatePath("/", "layout");
  redirect("/dashboard");
}

export async function registerUser(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const displayName = String(formData.get("displayName") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const role = String(formData.get("role") ?? "buyer");
  const rawPhone = String(formData.get("phone") ?? "").trim();
  const phone = rawPhone ? normalizePhone(rawPhone) : null;

  if (displayName.length < 2) {
    return { error: "Your name must be at least 2 characters", status: "invalid_input" };
  }

  if (!EMAIL_PATTERN.test(email)) {
    return { error: "Enter a valid email address", status: "invalid_input" };
  }

  if (password.length < 8) {
    return { error: "Password must be at least 8 characters", status: "invalid_input" };
  }

  if (!(AUTH_ROLES as readonly string[]).includes(role)) {
    return { error: "Choose a buyer or seller account", status: "invalid_input" };
  }

  if (await getUserByEmail(email)) {
    return { error: "An account with that email already exists", status: "email_taken" };
  }

  if (phone && (await getUserByPhone(phone))) {
    return { error: "An account with that phone already exists", status: "phone_taken" };
  }

  const user = await createUser({
    id: createUserId(),
    displayName,
    role: role as EscrowRole,
    email,
    passwordHash: hashPassword(password),
    phone,
  });

  await createSession(user.id);
  revalidatePath("/", "layout");
  redirect("/dashboard");
}

export async function logoutUser(): Promise<void> {
  await destroySession();
  revalidatePath("/", "layout");
  redirect("/login");
}

export async function depositFunds(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await requireActor();

  try {
    const amountCents = parseAmountToCents(String(formData.get("amount") ?? ""));
    const intent = await createPaymentIntent({
      userId: actor.id,
      kind: "deposit",
      amountCents,
    });
    await depositWalletFunds(actor.id, amountCents, `Deposit via ${intent.reference}`);
    await settlePaymentIntent(intent.id, {
      status: "completed",
      detail: "Demo cash rail settled instantly",
    });

    revalidatePath("/dashboard");

    return IDLE_ACTION_STATE;
  } catch (error) {
    return toActionState(error);
  }
}

export async function withdrawFunds(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await requireActor();

  try {
    const amountCents = parseAmountToCents(String(formData.get("amount") ?? ""));
    const phone = String(formData.get("phone") ?? "").trim() || null;
    let intent;
    try {
      intent = await createPaymentIntent({
        userId: actor.id,
        kind: "withdrawal",
        amountCents,
        phone,
      });

      await withdrawFromWallet(
        actor.id,
        amountCents,
        `Withdrawal via ${intent.reference}`,
        undefined,
        intent.id,
      );
      await settlePaymentIntent(intent.id, {
        status: "completed",
        detail: "Demo cash rail paid out",
      });
    } catch (error) {
      if (intent) {
        await settlePaymentIntent(intent.id, {
          status: "failed",
          detail: error instanceof Error ? error.message : "Payout failed",
        });
      }
      throw error;
    }

    revalidatePath("/dashboard");

    return IDLE_ACTION_STATE;
  } catch (error) {
    return toActionState(error);
  }
}

export async function runEscrowAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await requireActor();
  const transactionId = String(formData.get("transactionId") ?? "");
  const action = String(formData.get("action") ?? "");

  try {
    if (!transactionId || !isEscrowAction(action)) {
      throw new EscrowError("invalid_input", "A transaction and a valid action are required");
    }

    await applyActionToTransaction(transactionId, actor, buildPayload(action, formData));
    await processNotifications();

    revalidatePath("/dashboard");
    revalidatePath("/escrow");
    revalidatePath(`/escrow/${transactionId}`);

    return IDLE_ACTION_STATE;
  } catch (error) {
    return toActionState(error);
  }
}

export async function openEscrow(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await requireActor();
  let transactionId: string;

  try {
    const transaction = await createTransaction(
      {
        buyerId: actor.id,
        sellerId: String(formData.get("sellerId") ?? ""),
        itemName: String(formData.get("itemName") ?? ""),
        amountCents: parseAmountToCents(String(formData.get("amount") ?? "")),
      },
      actor,
    );
    await processNotifications();

    transactionId = transaction.id;
  } catch (error) {
    return toActionState(error);
  }

  revalidatePath("/dashboard");
  revalidatePath("/escrow");

  redirect(`/escrow/${transactionId}`);
}

export async function setPrefs(input: {
  lang?: string;
  currency?: string;
}): Promise<void> {
  const actor = await requireActor();
  const lang = isLang(input.lang) ? input.lang : undefined;
  const currency = isCurrency(input.currency) ? input.currency : undefined;

  if (lang && currency) {
    await updateUserPrefs(actor.id, { lang, currency });
  }

  await setPrefsCookie({
    lang: lang ?? "en",
    currency: currency ?? "KES",
  });

  revalidatePath("/", "layout");
}

function buildPayload(action: EscrowAction, formData: FormData): EscrowActionPayload {
  if (action === "dispatch") {
    return {
      action,
      input: {
        trackingNumber: String(formData.get("trackingNumber") ?? ""),
        carrierId: String(formData.get("carrierId") ?? ""),
        carrierName: String(formData.get("carrierName") ?? ""),
        origin: String(formData.get("origin") ?? ""),
        destination: String(formData.get("destination") ?? ""),
      },
    };
  }

  return { action, input: { note: String(formData.get("note") ?? "") } };
}