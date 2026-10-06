import Link from "next/link";
import type { ReactNode } from "react";

import type { EscrowActor } from "@/lib/escrow";
import type { LocalePrefs } from "@/lib/i18n";
import { SessionBar } from "@/app/components/SessionBar";

export function WorkspaceShell({
  actor,
  walletBalance,
  prefs,
  eyebrow,
  title,
  children,
}: {
  actor: EscrowActor;
  walletBalance: number;
  prefs: LocalePrefs;
  eyebrow: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <main className="min-h-screen bg-[#f5f7f3] px-6 py-10 text-[#18352d]">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm uppercase tracking-[0.22em] text-[#1e4d3d]">{eyebrow}</p>
            <h1 className="mt-2 text-3xl font-semibold text-[#18352d]">{title}</h1>
          </div>
          <nav className="flex items-center gap-3 text-sm">
            <Link
              href="/"
              className="rounded-full border border-[#dfece5] bg-white px-4 py-2 text-[#18352d] transition hover:border-[#1e4d3d] hover:text-[#1e4d3d]"
            >
              Home
            </Link>
            <Link
              href="/escrow"
              className="rounded-full border border-[#dfece5] bg-white px-4 py-2 text-[#18352d] transition hover:border-[#1e4d3d] hover:text-[#1e4d3d]"
            >
              Escrow
            </Link>
            <Link
              href="/dashboard"
              className="rounded-full bg-[#1e4d3d] px-4 py-2 font-semibold text-white transition hover:bg-[#123a30]"
            >
              Dashboard
            </Link>
          </nav>
        </div>

        <SessionBar actor={actor} walletBalance={walletBalance} prefs={prefs} />

        {children}
      </div>
    </main>
  );
}