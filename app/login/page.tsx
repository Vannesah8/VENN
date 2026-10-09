import Link from "next/link";
import { redirect } from "next/navigation";

import { LoginForm } from "@/app/components/LoginForm";
import { t } from "@/lib/i18n";
import { getPrefsFromCookies } from "@/lib/prefs";
import { getCurrentActor } from "@/lib/session";

export default async function LoginPage() {
  const [actor, prefs] = await Promise.all([getCurrentActor(), getPrefsFromCookies()]);

  if (actor) {
    redirect("/dashboard");
  }

  return (
    <main className="auth-page flex min-h-screen flex-col items-center justify-center px-6 py-16 text-[#f5f9f7]">
      <div className="relative w-full max-w-[30rem]">
        <Link href="/" className="mb-8 block text-white/90">
          <span className="text-[2.3rem] font-light tracking-[-0.08em] text-white">VENN</span>
        </Link>

        <div className="auth-card rounded-[2rem] border border-white/10 bg-white/6 p-8 shadow-[0_24px_70px_rgba(3,15,21,0.45)] backdrop-blur-md">
          <p className="text-[0.72rem] uppercase tracking-[0.24em] text-[#c7fce7]">
            {t(prefs.lang, "login.welcome")}
          </p>
          <h1 className="mt-3 text-[clamp(2.25rem,4vw,3.4rem)] font-light leading-[1.05] tracking-[-0.06em] text-white">
            {t(prefs.lang, "login.title")}
          </h1>
          <p className="mt-3 text-base leading-relaxed text-white/72">
            {t(prefs.lang, "login.subtitle")}
          </p>

          <div className="mt-7">
            <LoginForm prefs={prefs} />
          </div>
        </div>

        <p className="auth-card mt-6 rounded-2xl border border-white/10 bg-[#071f29]/55 px-4 py-3 text-sm text-white/72 backdrop-blur-sm">
          {t(prefs.lang, "login.demoAccounts", { password: "venn-demo" })}. Sign up to create a
          new buyer or seller identity, or sign in by phone using an SMS code.
        </p>
      </div>
    </main>
  );
}