"use client";

import Link from "next/link";
import { useActionState, useState, type ReactNode } from "react";

import { registerUser } from "@/app/actions";
import { IDLE_ACTION_STATE } from "@/lib/action-state";
import { roleLabel } from "@/lib/format";
import { t, type LocalePrefs, type MessageKey } from "@/lib/i18n";

const ROLES = ["buyer", "seller"] as const;
type Role = (typeof ROLES)[number];

const ROLE_HINT: Record<Role, MessageKey> = {
  buyer: "register.roleBuyerHint",
  seller: "register.roleSellerHint",
};

const STRENGTH_LABEL: readonly MessageKey[] = [
  "register.strength.weak",
  "register.strength.fair",
  "register.strength.strong",
  "register.strength.excellent",
];

const STRENGTH_TONE = ["#b45309", "#b45309", "#1e4d3d", "#1e4d3d"];

const INPUT =
  "w-full rounded-lg border border-[#dfece5] bg-white px-3 py-2.5 text-sm text-[#18352d] outline-none transition placeholder:text-[#a9b6af] focus:border-[#1e4d3d] focus:ring-4 focus:ring-[#1e4d3d]/10";

function toHandle(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s._-]/g, "")
    .replace(/\s+/g, ".");
}

function assess(password: string) {
  const hasLength = password.length >= 8;
  const hasCase = /[a-z]/.test(password) && /[A-Z]/.test(password);
  const hasNumber = /[0-9]/.test(password) || /[^a-zA-Z0-9]/.test(password);

  let charset = 0;
  if (/[a-z]/.test(password)) charset += 26;
  if (/[A-Z]/.test(password)) charset += 26;
  if (/[0-9]/.test(password)) charset += 10;
  if (/[^a-zA-Z0-9]/.test(password)) charset += 32;
  const bits = charset > 0 ? Math.round(password.length * Math.log2(charset)) : 0;

  let score = 0;
  if (hasLength) score += 1;
  if (password.length >= 12) score += 1;
  if (hasCase) score += 1;
  if (hasNumber) score += 1;

  return { score, bits, hasLength, hasCase, hasNumber };
}

function Field({
  index,
  label,
  hint,
  children,
}: {
  index: string;
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="grid grid-cols-[1.75rem_1fr] gap-x-3">
      <span aria-hidden className="pt-2.5 font-mono text-[11px] text-[#b0bcb5]">
        {index}
      </span>
      <div className="min-w-0">
        <div className="flex items-baseline justify-between gap-3">
          <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-[#5d736a]">
            {label}
          </span>
          {hint ? <span className="text-[10px] text-[#b0bcb5]">{hint}</span> : null}
        </div>
        <div className="mt-1.5">{children}</div>
      </div>
    </div>
  );
}

function CheckLine({ ok, label }: { ok: boolean; label: string }) {
  return (
    <li className={`flex items-center gap-2 ${ok ? "text-[#1e4d3d]" : "text-[#8b9d95]"}`}>
      <span aria-hidden className="font-mono text-[11px]">
        {ok ? "✓" : "·"}
      </span>
      <span>{label}</span>
    </li>
  );
}

export function RegisterForm({ prefs }: { prefs: LocalePrefs }) {
  const lang = prefs.lang;
  const [state, formAction, pending] = useActionState(registerUser, IDLE_ACTION_STATE);
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");

  const handle = toHandle(displayName);
  const meter = assess(password);
  const level = Math.max(1, Math.min(4, meter.score));

  return (
    <form action={formAction} className="space-y-6">
      {state.error ? (
        <p
          role="alert"
          className="rounded-lg border border-[#e3c98a] bg-[#fbf3e2] px-4 py-3 text-sm text-[#8a5a12]"
        >
          {state.error}
        </p>
      ) : null}

      <fieldset>
        <legend className="font-mono text-[11px] uppercase tracking-[0.18em] text-[#5d736a]">
          {t(lang, "register.role")}
        </legend>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {ROLES.map((role) => (
            <label
              key={role}
              className="flex cursor-pointer items-start gap-3 rounded-xl border border-[#dfece5] bg-white p-4 transition hover:border-[#bfd4c8] has-[:checked]:border-[#1e4d3d] has-[:checked]:bg-[#edf3ee]"
            >
              <input
                type="radio"
                name="role"
                value={role}
                defaultChecked={role === "buyer"}
                className="sr-only"
              />
              <span
                aria-hidden
                className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-[#cfe0d6] font-mono text-sm text-[#1e4d3d]"
              >
                {role === "buyer" ? "↓" : "↑"}
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-[#18352d]">
                  {roleLabel(role, lang)}
                </span>
                <span className="mt-1 block text-xs leading-relaxed text-[#5d736a]">
                  {t(lang, ROLE_HINT[role])}
                </span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <Field index="01" label={t(lang, "register.name")}>
        <input
          name="displayName"
          required
          autoComplete="name"
          placeholder="Zola Nkosi"
          value={displayName}
          onChange={(event) => setDisplayName(event.target.value)}
          className={INPUT}
        />
        {handle ? (
          <p className="mt-1.5 font-mono text-[11px] text-[#8b9d95]">
            {t(lang, "register.handle")}: <span className="text-[#1e4d3d]">@{handle}</span>
          </p>
        ) : null}
      </Field>

      <Field index="02" label={t(lang, "login.email")}>
        <input
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="zola@example.com"
          className={INPUT}
        />
      </Field>

      <Field index="03" label={t(lang, "register.password")}>
        <input
          name="password"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          placeholder="8+ characters"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className={INPUT}
        />
        {password ? (
          <div className="mt-3">
            <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.16em] text-[#8b9d95]">
              <span>{t(lang, "register.strengthLabel")}</span>
              <span>
                {t(lang, STRENGTH_LABEL[level - 1])} ·{" "}
                {t(lang, "register.bits", { bits: meter.bits })}
              </span>
            </div>
            <div className="mt-2 flex gap-1.5">
              {[0, 1, 2, 3].map((step) => (
                <span
                  key={step}
                  className="h-1 flex-1 rounded-full transition-colors"
                  style={{ background: step < level ? STRENGTH_TONE[level - 1] : "#dfece5" }}
                />
              ))}
            </div>
            <ul className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
              <CheckLine ok={meter.hasLength} label={t(lang, "register.check.length")} />
              <CheckLine ok={meter.hasCase} label={t(lang, "register.check.case")} />
              <CheckLine ok={meter.hasNumber} label={t(lang, "register.check.number")} />
            </ul>
          </div>
        ) : null}
      </Field>

      <Field index="04" label={t(lang, "register.phone")} hint={t(lang, "register.optional")}>
        <input
          name="phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder="+254712345678"
          className={INPUT}
        />
      </Field>

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-[#1e4d3d] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#123a30] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? t(lang, "register.creating") : t(lang, "register.create")}
      </button>

      <p className="text-center text-sm text-[#5d736a]">
        {t(lang, "register.signInLink")}{" "}
        <Link href="/login" className="text-[#1e4d3d] hover:underline">
          {t(lang, "login.signIn")}
        </Link>
      </p>
    </form>
  );
}
