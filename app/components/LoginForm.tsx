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
      <div className="flex rounded-full border border-white/10 bg-white/7 p-1 text-sm shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]">
        <button
          type="button"
          onClick={() => setMode("password")}
          className={`flex-1 rounded-full px-4 py-2 text-base transition ${
            mode === "password"
              ? "bg-[#dff9ee] font-medium text-[#0f2b2d] shadow-[0_8px_20px_rgba(126,249,217,0.2)]"
              : "text-white/75 hover:text-white"
          }`}
        >
          {t(lang, "login.passwordMode")}
        </button>
        <button
          type="button"
          onClick={() => setMode("otp")}
          className={`flex-1 rounded-full px-4 py-2 text-base transition ${
            mode === "otp"
              ? "bg-[#dff9ee] font-medium text-[#0f2b2d] shadow-[0_8px_20px_rgba(126,249,217,0.2)]"
              : "text-white/75 hover:text-white"
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

          <label className="block text-sm text-white/70">
            {t(lang, "login.email")}
            <input
              name="email"
              type="email"
              required
              autoComplete="email"
              placeholder="aisha_mwangi@venn.demo"
              className="mt-2 w-full rounded-2xl border border-white/10 bg-white/80 px-4 py-3 text-base text-[#18352d] shadow-[inset_0_1px_0_rgba(255,255,255,0.6)] outline-none transition placeholder:text-[#7f8d88] focus:border-[#1e4d3d] focus:bg-white focus:ring-4 focus:ring-[#1e4d3d]/10"
            />
          </label>

          <label className="block text-sm text-white/70">
            {t(lang, "login.password")}
            <input
              name="password"
              type="password"
              required
              autoComplete="current-password"
              placeholder="••••••••"
              className="mt-2 w-full rounded-2xl border border-white/10 bg-white/80 px-4 py-3 text-base text-[#18352d] shadow-[inset_0_1px_0_rgba(255,255,255,0.6)] outline-none transition placeholder:text-[#7f8d88] focus:border-[#1e4d3d] focus:bg-white focus:ring-4 focus:ring-[#1e4d3d]/10"
            />
          </label>

          <button
            type="submit"
            disabled={passwordPending}
            className="w-full rounded-2xl bg-[#dff9ee] px-5 py-3 text-base font-medium text-[#0f2b2d] shadow-[0_14px_30px_rgba(126,249,217,0.16)] transition hover:bg-[#d0f4e5] disabled:cursor-not-allowed disabled:opacity-60"
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

          <label className="block text-sm text-white/70">
            {t(lang, "login.phone")}
            <div className="mt-2 flex gap-2">
              <input
                name="phone"
                type="tel"
                required
                autoComplete="tel"
                inputMode="tel"
                placeholder="+254712345678"
                className="w-full flex-1 rounded-2xl border border-white/10 bg-white/80 px-4 py-3 text-base text-[#18352d] shadow-[inset_0_1px_0_rgba(255,255,255,0.6)] outline-none transition placeholder:text-[#7f8d88] focus:border-[#1e4d3d] focus:bg-white focus:ring-4 focus:ring-[#1e4d3d]/10"
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
                className="rounded-2xl border border-[#dff9ee] bg-[#dff9ee]/10 px-4 py-3 text-sm font-medium text-[#dff9ee] transition hover:bg-[#dff9ee] hover:text-[#0f2b2d] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {t(lang, "login.requestCode")}
              </button>
            </div>
          </label>

          <label className="block text-sm text-white/70">
            {t(lang, "login.otpCode")}
            <input
              name="code"
              type="text"
              required
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="123456"
              className="mt-2 w-full rounded-2xl border border-white/10 bg-white/80 px-4 py-3 text-base text-[#18352d] shadow-[inset_0_1px_0_rgba(255,255,255,0.6)] outline-none transition placeholder:text-[#7f8d88] focus:border-[#1e4d3d] focus:bg-white focus:ring-4 focus:ring-[#1e4d3d]/10"
            />
          </label>

          <button
            type="submit"
            disabled={otpPending}
            className="w-full rounded-2xl bg-[#dff9ee] px-5 py-3 text-base font-medium text-[#0f2b2d] shadow-[0_14px_30px_rgba(126,249,217,0.16)] transition hover:bg-[#d0f4e5] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {otpPending ? t(lang, "login.signingIn") : t(lang, "login.verify")}
          </button>

          {sendState.status === "otp_sent" ? (
            <p className="text-center text-xs text-[#5d736a]">{t(lang, "otp.sent")}</p>
          ) : null}
        </form>
      )}

      <p className="text-center text-xs text-white/65">
        {t(lang, "login.demoAccounts", { password: "venn-demo" })}.
      </p>
      <p className="text-center text-base text-white/72">
        <Link href="/register" className="font-medium text-white hover:underline">
          {t(lang, "login.signUpLink")}
        </Link>
      </p>
    </div>
  );
}