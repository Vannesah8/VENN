import { NextResponse } from "next/server";

import { parseAmountToCents } from "@/lib/money";
import { escrowErrorResponse, readJson, requireActorOrResponse } from "@/lib/api";
import { EscrowError } from "@/lib/escrow";
import { getCurrentActor } from "@/lib/session";
import { createTransaction, listTransactionsForActor } from "@/lib/transactions";

export async function GET() {
  const actor = await getCurrentActor();
  const guard = requireActorOrResponse(actor);

  if (guard) {
    return guard;
  }

  return NextResponse.json({
    actor: { id: actor!.id, role: actor!.role },
    transactions: listTransactionsForActor(actor!),
  });
}

export async function POST(request: Request) {
  const actor = await getCurrentActor();
  const guard = requireActorOrResponse(actor);

  if (guard) {
    return guard;
  }

  try {
    const body = await readJson(request);
    const sellerId = String(body.sellerId ?? "");
    const itemName = String(body.itemName ?? "");

    if (!sellerId || !itemName) {
      throw new EscrowError("invalid_input", "sellerId and itemName are required");
    }

    const transaction = createTransaction(
      {
        buyerId: actor!.id,
        sellerId,
        itemName,
        amountCents: parseAmountToCents(String(body.amount ?? "")),
      },
      actor!,
    );

    return NextResponse.json({ transaction }, { status: 201 });
  } catch (error) {
    return escrowErrorResponse(error);
  }
}