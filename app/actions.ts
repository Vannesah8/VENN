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
import { parseAmountToCents } from "@/lib/money";
import { createSession, destroySession, requireActor } from "@/lib/session";
import {
  applyActionToTransaction,
  createTransaction,
  createUserId,
  createUser,
  depositWalletFunds,
  getUserByEmail,
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

  const user = getUserByEmail(email);

  if (!user || !user.passwordHash || !verifyPassword(password, user.passwordHash)) {
    return { error: "Invalid email or password", status: "invalid_credentials" };
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

  if (getUserByEmail(email)) {
    return { error: "An account with that email already exists", status: "email_taken" };
  }

  const user = createUser({
    id: createUserId(),
    displayName,
    role: role as EscrowRole,
    email,
    passwordHash: hashPassword(password),
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
    depositWalletFunds(actor.id, amountCents, "Deposit from the demo cash rail");

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

    applyActionToTransaction(transactionId, actor, buildPayload(action, formData));

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
    const transaction = createTransaction(
      {
        buyerId: actor.id,
        sellerId: String(formData.get("sellerId") ?? ""),
        itemName: String(formData.get("itemName") ?? ""),
        amountCents: parseAmountToCents(String(formData.get("amount") ?? "")),
      },
      actor,
    );

    transactionId = transaction.id;
  } catch (error) {
    return toActionState(error);
  }

  revalidatePath("/dashboard");
  revalidatePath("/escrow");

  redirect(`/escrow/${transactionId}`);
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