import { NextResponse } from "next/server";

import { escrowErrorResponse, requireActorOrResponse } from "@/lib/api";
import { getUserConnectAuthUrl, isConnectConfigured } from "@/lib/connect";
import { getCurrentActor } from "@/lib/session";

export async function POST() {
  if (!isConnectConfigured()) {
    return NextResponse.json(
      { error: "Vercel Connect is not configured" },
      { status: 501 },
    );
  }

  const actor = await getCurrentActor();
  const guard = requireActorOrResponse(actor);

  if (guard) {
    return guard;
  }

  try {
    const url = await getUserConnectAuthUrl(actor!.id);
    return NextResponse.json({ url });
  } catch (error) {
    return escrowErrorResponse(error);
  }
}