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
    <main className="auth-page min-h-screen text-[#f7fbfa] lg:grid lg:grid-cols-[0.95fr_1.05fr]">
      <section className="relative hidden overflow-hidden bg-[#071f29]/42 px-12 py-12 text-[#e8f1ec] backdrop-blur-[2px] lg:flex lg:flex-col lg:justify-between">
        <div
          aria-hidden
          className="pointer-events-none absolute left-4 top-1/2 hidden -translate-y-1/2 -rotate-90 font-sans text-[10px] uppercase tracking-[0.45em] text-[#e8f1ec]/30 xl:block"
        >
          escrow · tracking · disputes
        </div>

        <div className="relative ml-10">
          <span className="text-[2.4rem] font-light tracking-[-0.09em] text-white">VENN</span>
        </div>

        <div className="relative max-w-[32rem]">
          <span className="text-[0.72rem] uppercase tracking-[0.3em] text-[#b7e8d9]">
            {t(lang, "register.panel.kicker")}
          </span>
          <h2 className="mt-8 text-[clamp(2.5rem,4vw,4.5rem)] font-light leading-[0.9] tracking-[-0.08em] text-white xl:text-[4rem]">
            {t(lang, "register.panel.title")}
          </h2>
          <ul className="mt-12 space-y-7">
            {points.map((point) => (
              <li key={point.index} className="border-t border-[#e8f1ec]/15 pt-5">
                <div>
                  <p className="text-base font-medium text-white">{point.title}</p>
                  <p className="mt-2 text-sm leading-relaxed text-[#c7d8cf]">{point.body}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-[0.72rem] uppercase tracking-[0.28em] text-[#a9c7b8]">
          {t(lang, "register.panel.footnote")}
        </p>
      </section>

      <section className="flex min-h-screen flex-col justify-center px-6 py-14 sm:px-12 lg:px-16">
        <div className="w-full max-w-[30rem]">
          <Link href="/" className="mb-8 block text-white/90 lg:hidden">
            <span className="text-[2.2rem] font-light tracking-[-0.08em] text-white">VENN</span>
          </Link>

          <p className="mt-8 text-[0.72rem] uppercase tracking-[0.24em] text-[#c7fce7] lg:mt-0">
            {t(lang, "register.eyebrow")}
          </p>
          <h1 className="mt-4 text-[clamp(2.5rem,5vw,5rem)] font-light leading-[0.95] tracking-[-0.08em] text-white">
            {t(lang, "register.title")}
          </h1>
          <p className="mt-3 text-base leading-relaxed text-white/72">{t(lang, "register.subtitle")}</p>

          <div className="mt-8">
            <RegisterForm prefs={prefs} />
          </div>
        </div>
      </section>
    </main>
  );
}
