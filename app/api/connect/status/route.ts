import { NextResponse } from "next/server";

import { escrowErrorResponse, requireActorOrResponse } from "@/lib/api";
import { isConnectConfigured, resolveUserConnectAuthorization } from "@/lib/connect";
import { getCurrentActor } from "@/lib/session";

export async function GET() {
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
    const result = await resolveUserConnectAuthorization(actor!.id);
    return NextResponse.json({ configured: true, authorized: result.authorized });
  } catch (error) {
    return escrowErrorResponse(error);
  }
}