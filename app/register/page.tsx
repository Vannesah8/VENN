import Link from "next/link";
import { redirect } from "next/navigation";

import { RegisterForm } from "@/app/components/RegisterForm";
import { t } from "@/lib/i18n";
import { getPrefsFromCookies } from "@/lib/prefs";
import { getCurrentActor } from "@/lib/session";

export default async function RegisterPage() {
  const [actor, prefs] = await Promise.all([getCurrentActor(), getPrefsFromCookies()]);
  const lang = prefs.lang;

  if (actor) {
    redirect("/dashboard");
  }

  const points = [
    {
      index: "01",
      title: t(lang, "register.panel.point1.title"),
      body: t(lang, "register.panel.point1.body"),
    },
    {
      index: "02",
      title: t(lang, "register.panel.point2.title"),
      body: t(lang, "register.panel.point2.body"),
    },
    {
      index: "03",
      title: t(lang, "register.panel.point3.title"),
      body: t(lang, "register.panel.point3.body"),
    },
  ];

  return (
    <main className="min-h-screen bg-[#f5f7f3] text-[#18352d] lg:grid lg:grid-cols-[0.95fr_1.05fr]">
      <section className="relative hidden overflow-hidden bg-[#123a30] px-12 py-12 text-[#e8f1ec] lg:flex lg:flex-col lg:justify-between">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.1]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.7) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.7) 1px, transparent 1px)",
            backgroundSize: "46px 46px",
          }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute left-4 top-1/2 hidden -translate-y-1/2 -rotate-90 font-mono text-[10px] uppercase tracking-[0.5em] text-[#e8f1ec]/30 xl:block"
        >
          escrow · tracking · disputes
        </div>

        <div className="relative flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-md border border-[#e8f1ec]/30 font-mono text-sm font-bold">
            V
          </span>
          <span className="font-mono text-[11px] uppercase tracking-[0.3em] text-[#e8f1ec]/70">
            {t(lang, "register.panel.kicker")}
          </span>
        </div>

        <div className="relative max-w-md">
          <span className="font-mono text-[11px] uppercase tracking-[0.3em] text-[#a9c7b8]">
            IDENTITY / 001
          </span>
          <h2 className="mt-5 text-3xl font-semibold leading-tight text-white xl:text-[2.6rem]">
            {t(lang, "register.panel.title")}
          </h2>
          <ul className="mt-10 space-y-6">
            {points.map((point) => (
              <li key={point.index} className="border-t border-[#e8f1ec]/15 pt-4">
                <div className="flex gap-4">
                  <span className="font-mono text-xs text-[#a9c7b8]">{point.index}</span>
                  <div>
                    <p className="text-sm font-semibold text-white">{point.title}</p>
                    <p className="mt-1 text-sm leading-relaxed text-[#c7d8cf]">{point.body}</p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative font-mono text-[11px] uppercase tracking-[0.2em] text-[#a9c7b8]">
          {t(lang, "register.panel.footnote")}
        </p>
      </section>

      <section className="flex min-h-screen flex-col justify-center px-6 py-14 sm:px-12 lg:px-16">
        <div className="w-full max-w-md">
          <Link href="/" className="flex items-center gap-3 lg:hidden">
            <span className="flex h-9 w-9 items-center justify-center rounded-md border border-[#cfe0d6] font-mono text-sm font-bold text-[#1e4d3d]">
              V
            </span>
            <span className="font-mono text-[11px] uppercase tracking-[0.3em] text-[#5d736a]">
              Venn
            </span>
          </Link>

          <p className="mt-8 font-mono text-[11px] uppercase tracking-[0.24em] text-[#1e4d3d] lg:mt-0">
            {t(lang, "register.eyebrow")}
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight">
            {t(lang, "register.title")}
          </h1>
          <p className="mt-2 text-sm text-[#5d736a]">{t(lang, "register.subtitle")}</p>

          <div className="mt-8">
            <RegisterForm prefs={prefs} />
          </div>
        </div>
      </section>
    </main>
  );
}
