"use client";

import Link from "next/link";
import { useActionState } from "react";

import { loginUser } from "@/app/actions";
import { IDLE_ACTION_STATE } from "@/lib/action-state";

export function LoginForm() {
  const [state, formAction, pending] = useActionState(loginUser, IDLE_ACTION_STATE);

  return (
    <form action={formAction} className="space-y-4">
      {state.error ? (
        <p
          role="alert"
          className="rounded-2xl border border-[#e3c98a] bg-[#fbf3e2] px-4 py-3 text-sm text-[#8a5a12]"
        >
          {state.error}
        </p>
      ) : null}

      <label className="block text-sm text-[#5d736a]">
        Email
        <input
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="aisha_mwangi@venn.demo"
          className="mt-1 w-full rounded-xl border border-[#dfece5] bg-white px-3 py-2 text-sm text-[#18352d]"
        />
      </label>

      <label className="block text-sm text-[#5d736a]">
        Password
        <input
          name="password"
          type="password"
          required
          autoComplete="current-password"
          placeholder="••••••••"
          className="mt-1 w-full rounded-xl border border-[#dfece5] bg-white px-3 py-2 text-sm text-[#18352d]"
        />
      </label>

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-full bg-[#1e4d3d] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#123a30] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "Signing in..." : "Sign in"}
      </button>

      <p className="pt-1 text-center text-sm text-[#5d736a]">
        No account yet?{" "}
        <Link href="/register" className="text-[#1e4d3d] hover:underline">
          Create one
        </Link>
      </p>
    </form>
  );
}