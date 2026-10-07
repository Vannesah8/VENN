import { NextResponse } from "next/server";

import { EscrowError, type EscrowActor } from "@/lib/escrow";
import { getEscrowErrorStatus } from "@/lib/transactions";

export function unauthorized(): NextResponse {
  return NextResponse.json(
    { error: "Select an account first" },
    { status: 401 },
  );
}

export function escrowErrorResponse(error: unknown): NextResponse {
  if (error instanceof EscrowError) {
    return NextResponse.json(
      { error: error.message, code: error.code },
      { status: getEscrowErrorStatus(error.code) },
    );
  }

  return NextResponse.json(
    { error: error instanceof Error ? error.message : "Unexpected server error" },
    { status: 500 },
  );
}

export function requireActorOrResponse(actor: EscrowActor | null): NextResponse | null {
  return actor ? null : unauthorized();
}

export async function readJson(request: Request): Promise<Record<string, unknown>> {
  try {
    const body = await request.json();
    return typeof body === "object" && body !== null ? (body as Record<string, unknown>) : {};
  } catch {
    throw new EscrowError("invalid_input", "Request body must be valid JSON");
  }
}