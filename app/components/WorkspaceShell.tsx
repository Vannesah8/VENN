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
    <main className="min-h-screen bg-[#f5f7f3] px-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-6 text-[#18352d] sm:px-6 sm:py-10">
      <div className="mx-auto max-w-6xl space-y-5 sm:space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-[#1e4d3d] sm:text-sm">
              {eyebrow}
            </p>
            <h1 className="mt-1.5 text-2xl font-semibold text-[#18352d] sm:mt-2 sm:text-3xl">
              {title}
            </h1>
          </div>
          <nav className="grid grid-cols-3 gap-2 text-sm sm:flex sm:items-center sm:gap-3">
            <Link
              href="/"
              className="rounded-full border border-[#dfece5] bg-white px-3 py-2.5 text-center text-[#18352d] transition hover:border-[#1e4d3d] hover:text-[#1e4d3d] sm:px-4"
            >
              Home
            </Link>
            <Link
              href="/escrow"
              className="rounded-full border border-[#dfece5] bg-white px-3 py-2.5 text-center text-[#18352d] transition hover:border-[#1e4d3d] hover:text-[#1e4d3d] sm:px-4"
            >
              Escrow
            </Link>
            <Link
              href="/dashboard"
              className="rounded-full bg-[#1e4d3d] px-3 py-2.5 text-center font-semibold text-white transition hover:bg-[#123a30] sm:px-4"
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