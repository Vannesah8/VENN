"use client";

import Link from "next/link";
import { useActionState, useState } from "react";

import { loginUser, otpLogin, sendOtpLogin } from "@/app/actions";
import { IDLE_ACTION_STATE } from "@/lib/action-state";
import { t, type LocalePrefs } from "@/lib/i18n";

type Mode = "password" | "otp";

type OtpSendState = {
  error: string | null;
  status: string | null;
  demoCode?: string;
};

const IDLE_OTP_SEND: OtpSendState = { error: null, status: null, demoCode: undefined };

export function LoginForm({ prefs }: { prefs: LocalePrefs }) {
  const lang = prefs.lang;
  const [mode, setMode] = useState<Mode>("password");
  const [passwordState, passwordAction, passwordPending] = useActionState(
    loginUser,
    IDLE_ACTION_STATE,
  );
  const [otpState, otpAction, otpPending] = useActionState(otpLogin, IDLE_ACTION_STATE);
  const [sendState, sendAction, sendPending] = useActionState(sendOtpLogin, IDLE_OTP_SEND);

  return (
    <div className="space-y-4">
      <div className="flex rounded-full border border-[#dfece5] bg-white p-1 text-sm">
        <button
          type="button"
          onClick={() => setMode("password")}
          className={`flex-1 rounded-full px-4 py-1.5 transition ${
            mode === "password"
              ? "bg-[#1e4d3d] font-semibold text-white"
              : "text-[#5d736a] hover:text-[#1e4d3d]"
          }`}
        >
          {t(lang, "login.passwordMode")}
        </button>
        <button
          type="button"
          onClick={() => setMode("otp")}
          className={`flex-1 rounded-full px-4 py-1.5 transition ${
            mode === "otp"
              ? "bg-[#1e4d3d] font-semibold text-white"
              : "text-[#5d736a] hover:text-[#1e4d3d]"
          }`}
        >
          {t(lang, "login.phoneMode")}
        </button>
      </div>

      {mode === "password" ? (
        <form action={passwordAction} className="space-y-4">
          {passwordState.error ? (
            <p
              role="alert"
              className="rounded-2xl border border-[#e3c98a] bg-[#fbf3e2] px-4 py-3 text-sm text-[#8a5a12]"
            >
              {passwordState.error}
            </p>
          ) : null}

          <label className="block text-sm text-[#5d736a]">
            {t(lang, "login.email")}
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
            {t(lang, "login.password")}
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
            disabled={passwordPending}
            className="w-full rounded-full bg-[#1e4d3d] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#123a30] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {passwordPending ? t(lang, "login.signingIn") : t(lang, "login.signIn")}
          </button>
        </form>
      ) : (
        <form action={otpAction} className="space-y-4">
          {otpState.error ? (
            <p
              role="alert"
              className="rounded-2xl border border-[#e3c98a] bg-[#fbf3e2] px-4 py-3 text-sm text-[#8a5a12]"
            >
              {otpState.error}
            </p>
          ) : null}

          {sendState.demoCode ? (
            <p className="rounded-2xl border border-[#bfd4c8] bg-[#edf3ee] px-4 py-3 text-sm text-[#1e4d3d]">
              {t(lang, "login.demoCode")}{" "}
              <span className="font-mono text-base font-bold">{sendState.demoCode}</span>
            </p>
          ) : null}

          <label className="block text-sm text-[#5d736a]">
            {t(lang, "login.phone")}
            <div className="mt-1 flex gap-2">
              <input
                name="phone"
                type="tel"
                required
                autoComplete="tel"
                inputMode="tel"
                placeholder="+254712345678"
                className="w-full flex-1 rounded-xl border border-[#dfece5] bg-white px-3 py-2 text-sm text-[#18352d]"
              />
              <button
                type="button"
                formNoValidate
                disabled={sendPending}
                onClick={(event) => {
                  event.preventDefault();
                  const form = event.currentTarget.form;
                  if (!form) {
                    return;
                  }
                  const phone = new FormData(form).get("phone");
                  if (typeof phone === "string" && phone.trim()) {
                    sendAction(new FormData(form));
                  }
                }}
                className="rounded-xl border border-[#1e4d3d] px-4 py-2 text-sm font-semibold text-[#1e4d3d] transition hover:bg-[#1e4d3d] hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                {t(lang, "login.requestCode")}
              </button>
            </div>
          </label>

          <label className="block text-sm text-[#5d736a]">
            {t(lang, "login.otpCode")}
            <input
              name="code"
              type="text"
              required
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="123456"
              className="mt-1 w-full rounded-xl border border-[#dfece5] bg-white px-3 py-2 text-sm text-[#18352d]"
            />
          </label>

          <button
            type="submit"
            disabled={otpPending}
            className="w-full rounded-full bg-[#1e4d3d] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#123a30] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {otpPending ? t(lang, "login.signingIn") : t(lang, "login.verify")}
          </button>

          {sendState.status === "otp_sent" ? (
            <p className="text-center text-xs text-[#5d736a]">{t(lang, "otp.sent")}</p>
          ) : null}
        </form>
      )}

      <p className="text-center text-xs text-[#5d736a]">
        {t(lang, "login.demoAccounts", { password: "venn-demo" })}.
      </p>
      <p className="text-center text-sm text-[#5d736a]">
        <Link href="/register" className="text-[#1e4d3d] hover:underline">
          {t(lang, "login.signUpLink")}
        </Link>
      </p>
    </div>
  );
}