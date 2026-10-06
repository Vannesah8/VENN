import { NextResponse } from "next/server";

import { getDatabase } from "@/lib/db";

export async function GET() {
  const database = getDatabase();
  const row = database.prepare("SELECT COUNT(*) AS count FROM transactions").get() as {
    count: number;
  };

  return NextResponse.json({
    ok: true,
    service: "venn-backend",
    database: "connected",
    transactions: row.count,
    timestamp: new Date().toISOString(),
  });
}