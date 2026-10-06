import Link from "next/link";
import { redirect } from "next/navigation";

import { RegisterForm } from "@/app/components/RegisterForm";
import { getCurrentActor } from "@/lib/session";

export default async function RegisterPage() {
  const actor = await getCurrentActor();

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
          <p className="text-sm uppercase tracking-[0.22em] text-[#1e4d3d]">New identity</p>
          <h1 className="mt-2 text-2xl font-semibold">Create an account</h1>
          <p className="mt-2 text-sm text-[#5d736a]">
            Buyers fund escrow; sellers dispatch and get paid on release.
          </p>

          <div className="mt-6">
            <RegisterForm />
          </div>
        </div>
      </div>
    </main>
  );
}