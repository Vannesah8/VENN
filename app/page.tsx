import Link from "next/link";

export default function Home() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-transparent text-[#18352d]">
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="venn-grid absolute inset-0 opacity-70" />
        <div className="venn-blob left-[-12%] top-[-18%] h-[40rem] w-[40rem] bg-[#b9e0c9]" />
        <div
          className="venn-blob right-[-14%] top-[-6%] h-[32rem] w-[32rem] bg-[#dcebc6]"
          style={{ animationDelay: "-6s" }}
        />
        <div
          className="venn-blob bottom-[-24%] left-[28%] h-[36rem] w-[36rem] bg-[#cfe1f2]"
          style={{ animationDelay: "-12s" }}
        />
      </div>

      <div className="relative mx-auto max-w-6xl px-6 py-6 lg:px-8">
        <nav className="flex items-center justify-between rounded-full border border-[#dfece5] bg-white/70 px-5 py-3 shadow-[0_10px_30px_rgba(24,53,45,0.05)] backdrop-blur-md">
          <Link href="/" className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#1e4d3d] text-sm font-bold text-white">
              V
            </span>
            <span className="text-lg font-semibold text-[#18352d]">Venn</span>
          </Link>

          <div className="flex items-center gap-4">
            <Link
              href="/dashboard"
              className="hidden text-sm text-[#5d736a] transition hover:text-[#1e4d3d] sm:block"
            >
              Dashboard
            </Link>
            <Link
              href="/login"
              className="rounded-full bg-[#1e4d3d] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#123a30]"
            >
              Sign in
            </Link>
          </div>
        </nav>

        <section className="grid items-center gap-10 py-14 sm:gap-12 sm:py-20 lg:grid-cols-[1.1fr_0.9fr] lg:py-28">
          <div className="venn-rise">
            <span className="inline-flex items-center rounded-full border border-[#dfece5] bg-white/70 px-3 py-1 text-xs uppercase tracking-[0.18em] text-[#1e4d3d] backdrop-blur-sm">
              Escrow · Tracking · Payouts
            </span>

            <h1 className="mt-6 max-w-xl text-4xl font-semibold tracking-tight text-[#18352d] sm:text-5xl md:text-6xl">
              Escrow that pays when the parcel lands.
            </h1>

            <p className="mt-5 max-w-md text-lg leading-8 text-[#5d736a]">
              Funds stay held until delivery is confirmed, then release. No DM scams.
            </p>

            <div className="mt-8 flex flex-wrap gap-4">
              <Link
                href="/login"
                className="rounded-full bg-[#1e4d3d] px-6 py-3 font-semibold text-white transition hover:bg-[#123a30]"
              >
                Start trading
              </Link>
              <Link
                href="/escrow"
                className="rounded-full border border-[#dfece5] bg-white/80 px-6 py-3 font-semibold text-[#18352d] backdrop-blur-sm transition hover:border-[#1e4d3d] hover:text-[#1e4d3d]"
              >
                View escrow
              </Link>
            </div>
          </div>

          <div className="venn-rise" style={{ animationDelay: "120ms" }}>
            <div className="rounded-3xl border border-[#dfece5] bg-white/80 p-6 shadow-[0_24px_60px_rgba(24,53,45,0.10)] backdrop-blur-md">
              <div className="flex items-center justify-between">
                <span className="text-xs uppercase tracking-[0.2em] text-[#5d736a]">
                  Protected order
                </span>
                <span className="inline-flex items-center gap-2 rounded-full border border-[#bfd4c8] bg-[#edf3ee] px-3 py-1 text-xs text-[#1e4d3d]">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#1e4d3d]" />
                  In transit
                </span>
              </div>

              <p className="mt-5 text-sm text-[#5d736a]">Vintage camera lens</p>
              <p className="mt-1 text-3xl font-semibold tracking-tight text-[#18352d]">KES 1,240</p>

              <div className="mt-6">
                <div className="relative h-1.5 overflow-hidden rounded-full bg-[#edf3ee]">
                  <span className="absolute inset-y-0 left-0 w-2/3 rounded-full bg-[#1e4d3d]" />
                  <span className="venn-sheen absolute inset-y-0 left-0 w-2/3" />
                </div>
                <div className="mt-3 flex justify-between text-xs text-[#5d736a]">
                  <span className="text-[#1e4d3d]">Funded</span>
                  <span className="text-[#1e4d3d]">Shipped</span>
                  <span>Delivered</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <div className="flex flex-wrap items-center gap-x-8 gap-y-3 border-t border-[#dfece5] pt-6 font-mono text-xs uppercase tracking-[0.16em] text-[#5d736a]">
          <span>
            <span className="text-[#18352d]">KES 2.8M</span> protected
          </span>
          <span className="hidden h-3 w-px bg-[#dfece5] sm:block" />
          <span>
            <span className="text-[#18352d]">14.2K</span> parcels tracked
          </span>
          <span className="hidden h-3 w-px bg-[#dfece5] sm:block" />
          <span>
            <span className="text-[#18352d]">96%</span> disputes resolved
          </span>
        </div>
      </div>
    </main>
  );
}
