import { NextResponse } from "next/server";

import { parseAmountToCents } from "@/lib/money";
import { escrowErrorResponse, readJson, requireActorOrResponse } from "@/lib/api";
import { EscrowError } from "@/lib/escrow";
import { getCurrentActor } from "@/lib/session";
import {
  createTransaction,
  isTransactionFilter,
  pageTransactionsForActor,
} from "@/lib/transactions";

export async function GET(request: Request) {
  const actor = await getCurrentActor();
  const guard = requireActorOrResponse(actor);

  if (guard) {
    return guard;
  }

  const url = new URL(request.url);
  const cursor = url.searchParams.get("cursor") ?? null;
  const limitParam = Number(url.searchParams.get("limit") ?? "20");
  const limit = Number.isFinite(limitParam) && limitParam > 0 ? limitParam : 20;
  const filterParam = url.searchParams.get("filter");
  const filter = filterParam && isTransactionFilter(filterParam) ? filterParam : undefined;
  const query = url.searchParams.get("q")?.trim() || undefined;

  const page = await pageTransactionsForActor(actor!, { cursor, limit, filter, query });

  return NextResponse.json({
    actor: { id: actor!.id, role: actor!.role },
    transactions: page.transactions,
    nextCursor: page.nextCursor,
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

    const transaction = await createTransaction(
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