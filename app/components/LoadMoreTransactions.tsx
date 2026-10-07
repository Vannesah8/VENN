"use client";

import type { ReactNode } from "react";
import { useState } from "react";

import type { TransactionView } from "@/lib/transactions";

interface LoadedPage {
  itemName: string;
  id: string;
  amountCents: number;
  status: string;
  updatedAt: string;
  buyerName: string;
  sellerName: string;
}

export function LoadMoreTransactions({
  initialCursor,
  filter,
  query,
  className,
  children,
}: {
  initialCursor: string;
  filter?: string;
  query?: string;
  className?: string;
  children: (item: LoadedPage) => ReactNode;
}) {
  const [cursor, setCursor] = useState<string | null>(initialCursor);
  const [items, setItems] = useState<LoadedPage[]>([]);
  const [loading, setLoading] = useState(false);

  async function loadMore() {
    if (!cursor || loading) {
      return;
    }

    setLoading(true);
    try {
      const params = new URLSearchParams({ cursor, limit: "10" });
      if (filter) {
        params.set("filter", filter);
      }
      if (query) {
        params.set("q", query);
      }
      const response = await fetch(`/api/transactions?${params.toString()}`);
      const body = await response.json();
      const nextItems: TransactionView[] = body.transactions ?? [];

      setItems((current) => [...current, ...nextItems.map(normalize)]);
      setCursor(body.nextCursor);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={className}>
      {items.map((item) => children(item))}

      {cursor ? (
        <button
          type="button"
          onClick={loadMore}
          disabled={loading}
          className="mt-4 rounded-full border border-[#dfece5] bg-white px-5 py-2 text-sm font-semibold text-[#1e4d3d] transition hover:border-[#1e4d3d] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? "Loading…" : "Load more"}
        </button>
      ) : null}
    </div>
  );
}

function normalize(item: TransactionView): LoadedPage {
  return {
    itemName: item.itemName,
    id: item.id,
    amountCents: item.amountCents,
    status: item.status,
    updatedAt: new Date(item.updatedAt).toISOString(),
    buyerName: item.buyerName,
    sellerName: item.sellerName,
  };
}