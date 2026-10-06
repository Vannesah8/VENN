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
    <main className="flex min-h-screen flex-col items-center justify-center bg-[#f5f7f3] px-6 py-16 text-[#18352d]">
      <div className="w-full max-w-md">
        <Link href="/" className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#1e4d3d] text-base font-bold text-white">
            V
          </span>
          <span className="text-xl font-semibold">Venn</span>
        </Link>

        <div className="mt-8 rounded-3xl border border-[#dfece5] bg-white p-8 shadow-[0_16px_30px_rgba(24,53,45,0.06)]">
          <p className="text-sm uppercase tracking-[0.22em] text-[#1e4d3d]">
            {t(prefs.lang, "login.welcome")}
          </p>
          <h1 className="mt-2 text-2xl font-semibold">{t(prefs.lang, "login.title")}</h1>
          <p className="mt-2 text-sm text-[#5d736a]">
            {t(prefs.lang, "login.subtitle")}
          </p>

          <div className="mt-6">
            <LoginForm prefs={prefs} />
          </div>
        </div>

        <p className="mt-6 rounded-2xl border border-[#dfece5] bg-white px-4 py-3 text-xs text-[#5d736a]">
          {t(prefs.lang, "login.demoAccounts", { password: "venn-demo" })}. Sign up to create a
          new buyer or seller identity, or sign in by phone using an SMS code.
        </p>
      </div>
    </main>
  );
}