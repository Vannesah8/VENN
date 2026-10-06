import { NextResponse } from "next/server";

import { escrowErrorResponse, readJson, requireActorOrResponse } from "@/lib/api";
import {
  type EscrowActionPayload,
  EscrowError,
  canViewTransaction,
  isEscrowAction,
} from "@/lib/escrow";
import { getCurrentActor } from "@/lib/session";
import {
  applyActionToTransaction,
  getTransactionViewById,
  listEscrowEvents,
} from "@/lib/transactions";

export async function GET(
  _request: Request,
  { params }: RouteContext<"/api/transactions/[id]">,
) {
  const { id } = await params;
  const actor = await getCurrentActor();
  const guard = requireActorOrResponse(actor);

  if (guard) {
    return guard;
  }

  const transaction = getTransactionViewById(id);

  if (!transaction || !actor || !canViewTransaction(transaction, actor)) {
    return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
  }

  return NextResponse.json({ transaction, events: listEscrowEvents(id) });
}

export async function PATCH(
  request: Request,
  { params }: RouteContext<"/api/transactions/[id]">,
) {
  const { id } = await params;
  const actor = await getCurrentActor();
  const guard = requireActorOrResponse(actor);

  if (guard) {
    return guard;
  }

  try {
    const body = await readJson(request);
    const action = body.action;

    if (!isEscrowAction(action)) {
      throw new EscrowError("unknown_action", `Unsupported action: ${String(action)}`);
    }

    const transaction = applyActionToTransaction(
      id,
      actor!,
      buildPayload(action, body) as EscrowActionPayload,
    );

    return NextResponse.json({ transaction, events: listEscrowEvents(id) });
  } catch (error) {
    return escrowErrorResponse(error);
  }
}

function buildPayload(
  action: EscrowActionPayload["action"],
  body: Record<string, unknown>,
): EscrowActionPayload {
  if (action === "dispatch") {
    return {
      action,
      input: {
        trackingNumber: String(body.trackingNumber ?? ""),
        carrierId: String(body.carrierId ?? ""),
        carrierName: String(body.carrierName ?? ""),
        origin: String(body.origin ?? ""),
        destination: String(body.destination ?? ""),
      },
    };
  }

  return { action, input: { note: typeof body.note === "string" ? body.note : "" } };
}