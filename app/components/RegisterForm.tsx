"use client";

import Link from "next/link";
import { useActionState } from "react";

import { registerUser } from "@/app/actions";
import { IDLE_ACTION_STATE } from "@/lib/action-state";
import { roleLabel } from "@/lib/format";

const ROLES = ["buyer", "seller"] as const;

export function RegisterForm() {
  const [state, formAction, pending] = useActionState(registerUser, IDLE_ACTION_STATE);

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
        Name
        <input
          name="displayName"
          required
          autoComplete="name"
          placeholder="Zola Nkosi"
          className="mt-1 w-full rounded-xl border border-[#dfece5] bg-white px-3 py-2 text-sm text-[#18352d]"
        />
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm text-[#5d736a]">
          Email
          <input
            name="email"
            type="email"
            required
            autoComplete="email"
            placeholder="zola@example.com"
            className="mt-1 w-full rounded-xl border border-[#dfece5] bg-white px-3 py-2 text-sm text-[#18352d]"
          />
        </label>

        <label className="block text-sm text-[#5d736a]">
          Role
          <select
            name="role"
            defaultValue="buyer"
            className="mt-1 w-full rounded-xl border border-[#dfece5] bg-white px-3 py-2 text-sm text-[#18352d]"
          >
            {ROLES.map((role) => (
              <option key={role} value={role}>
                {roleLabel(role)}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="block text-sm text-[#5d736a]">
        Password
        <input
          name="password"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          placeholder="8+ characters"
          className="mt-1 w-full rounded-xl border border-[#dfece5] bg-white px-3 py-2 text-sm text-[#18352d]"
        />
      </label>

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-full bg-[#1e4d3d] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#123a30] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "Creating account..." : "Create account"}
      </button>

      <p className="pt-1 text-center text-sm text-[#5d736a]">
        Already signed up?{" "}
        <Link href="/login" className="text-[#1e4d3d] hover:underline">
          Sign in
        </Link>
      </p>
    </form>
  );
}