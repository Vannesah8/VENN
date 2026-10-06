import Link from "next/link";
import { marketFlow, trustFeatures, trustStats } from "@/lib/mockData";

export default function Home() {
  return (
    <main className="min-h-screen bg-[#f5f7f3] text-[#18352d]">
      <div className="mx-auto max-w-7xl px-6 py-8 lg:px-8">
        <nav className="flex items-center justify-between rounded-full border border-[#dfece5] bg-white/80 px-5 py-3 shadow-[0_10px_30px_rgba(24,53,45,0.05)] backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#1e4d3d] text-sm font-bold text-white">
              V
            </div>
            <div>
              <p className="text-lg font-semibold text-[#18352d]">Venn</p>
            </div>
          </div>

          <div className="hidden items-center gap-8 text-sm text-[#5d736a] md:flex">
            <Link href="#product" className="transition hover:text-[#1e4d3d]">
              Product
            </Link>
            <Link href="#flow" className="transition hover:text-[#1e4d3d]">
              Flow
            </Link>
            <Link href="/dashboard" className="transition hover:text-[#1e4d3d]">
              Dashboard
            </Link>
            <Link href="/escrow" className="transition hover:text-[#1e4d3d]">
              Escrow
            </Link>
          </div>

          <Link
            href="/login"
            className="rounded-full bg-[#1e4d3d] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#123a30]"
          >
            Sign in
          </Link>
        </nav>

        <section className="grid items-center gap-10 pb-12 pt-16 lg:grid-cols-[1.15fr_0.85fr] lg:pt-20">
          <div>
            <div className="mb-6 inline-flex items-center rounded-full border border-[#dfece5] bg-[#edf3ee] px-3 py-1 text-xs uppercase tracking-[0.18em] text-[#1e4d3d]">
              Trust-first commerce
            </div>
            <h1 className="max-w-xl text-5xl font-semibold tracking-tight text-[#18352d] md:text-6xl">
              Escrow and delivery tracking for social-media commerce.
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-8 text-[#5d736a]">
              Venn protects buyers and sellers by holding funds in escrow, verifying shipment progress,
              and releasing money only when trust conditions are satisfied.
            </p>

            <div className="mt-8 flex flex-wrap gap-4">
              <Link
                href="/login"
                className="rounded-full bg-[#1e4d3d] px-6 py-3 font-semibold text-white transition hover:bg-[#123a30]"
              >
                Open the app
              </Link>
              <Link
                href="#product"
                className="rounded-full border border-[#dfece5] bg-white px-6 py-3 font-semibold text-[#18352d] transition hover:border-[#1e4d3d] hover:text-[#1e4d3d]"
              >
                Explore product
              </Link>
            </div>
          </div>

          <div className="rounded-[32px] border border-[#dfece5] bg-white p-6 shadow-[0_18px_40px_rgba(24,53,45,0.08)]">
            <div className="rounded-[24px] border border-[#edf3ee] bg-[#f8faf8] p-5">
              <div className="mb-5 flex items-center justify-between text-sm text-[#5d736a]">
                <span>Protected transaction</span>
                <span className="rounded-full border border-[#bfd4c8] bg-[#edf3ee] px-2 py-1 text-xs text-[#1e4d3d]">
                  Funded
                </span>
              </div>

              <div className="space-y-4">
                <div className="rounded-2xl bg-white p-4 ring-1 ring-[#edf3ee]">
                  <p className="text-sm text-[#5d736a]">Seller</p>
                  <p className="mt-2 text-xl font-semibold text-[#18352d]">Keisha Trading Co.</p>
                </div>
                <div className="rounded-2xl bg-white p-4 ring-1 ring-[#edf3ee]">
                  <p className="text-sm text-[#5d736a]">Item</p>
                  <p className="mt-2 text-xl font-semibold text-[#18352d]">Vintage camera lens</p>
                </div>
                <div className="rounded-2xl bg-white p-4 ring-1 ring-[#edf3ee]">
                  <p className="text-sm text-[#5d736a]">Escrow value</p>
                  <p className="mt-2 text-3xl font-semibold text-[#1e4d3d]">$1,240</p>
                </div>
              </div>

              <div className="mt-5 rounded-2xl border border-[#dfece5] bg-[#edf3ee] p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-[#1e4d3d]">Last update</p>
                <p className="mt-2 text-sm text-[#18352d]">Package scanned in Nairobi hub. Release pending buyer confirmation.</p>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-4 border-y border-[#dfece5] py-8 md:grid-cols-4">
          {trustStats.map((stat) => (
            <div key={stat.label} className="rounded-2xl border border-[#dfece5] bg-white p-4 shadow-[0_8px_20px_rgba(24,53,45,0.04)]">
              <p className="text-2xl font-semibold text-[#18352d]">{stat.value}</p>
              <p className="mt-2 text-sm text-[#5d736a]">{stat.label}</p>
            </div>
          ))}
        </section>

        <section id="product" className="py-20">
          <div className="mb-10 max-w-2xl">
            <p className="text-sm uppercase tracking-[0.22em] text-[#1e4d3d]">Why Venn</p>
            <h2 className="mt-3 text-3xl font-semibold text-[#18352d] md:text-4xl">Built to close the trust gap in social commerce.</h2>
          </div>

          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            {trustFeatures.map((feature) => (
              <div key={feature.title} className="rounded-3xl border border-[#dfece5] bg-white p-6 shadow-[0_10px_30px_rgba(24,53,45,0.04)]">
                <div className="mb-4 h-11 w-11 rounded-2xl bg-[#edf3ee] ring-1 ring-[#dfece5]" />
                <h3 className="text-xl font-semibold text-[#18352d]">{feature.title}</h3>
                <p className="mt-3 text-base leading-7 text-[#5d736a]">{feature.description}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="flow" className="pb-20">
          <div className="mb-10 max-w-2xl">
            <p className="text-sm uppercase tracking-[0.22em] text-[#1e4d3d]">Operating model</p>
            <h2 className="mt-3 text-3xl font-semibold text-[#18352d] md:text-4xl">A safe transaction pipeline from DM to delivery.</h2>
          </div>

          <div className="grid gap-5 lg:grid-cols-4">
            {marketFlow.map((step) => (
              <div key={step.step} className="rounded-3xl border border-[#dfece5] bg-white p-5 shadow-[0_10px_25px_rgba(24,53,45,0.04)]">
                <p className="text-sm uppercase tracking-[0.2em] text-[#1e4d3d]">{step.step}</p>
                <h3 className="mt-4 text-xl font-semibold text-[#18352d]">{step.title}</h3>
                <p className="mt-3 text-sm leading-7 text-[#5d736a]">{step.description}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
