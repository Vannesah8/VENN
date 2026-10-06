import { NextResponse } from "next/server";

import { getDatabase } from "@/lib/db";

export async function GET() {
  const database = await getDatabase();
  const row = (await database.get<{ count: number }>(
    "SELECT COUNT(*) AS count FROM transactions",
  )) ?? { count: 0 };

  return NextResponse.json({
    ok: true,
    service: "venn-backend",
    database: "connected",
    transactions: row.count,
    timestamp: new Date().toISOString(),
  });
}