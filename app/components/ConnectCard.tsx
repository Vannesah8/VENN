"use client";

import { useEffect, useState } from "react";

import { t, type LocalePrefs } from "@/lib/i18n";

type ConnectView =
  | { kind: "loading" }
  | { kind: "hidden" }
  | { kind: "connected" }
  | { kind: "ready" }
  | { kind: "connecting" };

export function ConnectCard({ prefs }: { prefs: LocalePrefs }) {
  const lang = prefs.lang;
  const [view, setView] = useState<ConnectView>({ kind: "loading" });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    fetch("/api/connect/status")
      .then(async (response) => {
        if (!response.ok) {
          return null;
        }
        return (await response.json()) as { configured: boolean; authorized: boolean };
      })
      .then((status) => {
        if (cancelled) {
          return;
        }
        setView(
          status?.configured
            ? status.authorized
              ? { kind: "connected" }
              : { kind: "ready" }
            : { kind: "hidden" },
        );
      })
      .catch(() => {
        if (!cancelled) {
          setView({ kind: "hidden" });
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (view.kind === "loading" || view.kind === "hidden") {
    return null;
  }

  const connect = async () => {
    setError(null);
    setView({ kind: "connecting" });

    try {
      const response = await fetch("/api/connect/start", { method: "POST" });
      const body = (await response.json()) as { url?: string };

      if (response.ok && body.url) {
        window.location.href = body.url;
        return;
      }
    } catch {
      // fall through to the error state
    }

    setError(t(lang, "connect.error"));
    setView({ kind: "ready" });
  };

  return (
    <section className="rounded-3xl border border-[#dfece5] bg-white p-6 shadow-[0_16px_30px_rgba(24,53,45,0.05)]">
      <h2 className="text-xl font-semibold text-[#18352d]">{t(lang, "connect.title")}</h2>
      <p className="mt-2 text-sm text-[#5d736a]">{t(lang, "connect.blurb")}</p>

      {view.kind === "connected" ? (
        <p className="mt-4 inline-block rounded-full bg-[#e4f3ea] px-4 py-1.5 text-sm font-medium text-[#1e4d3d]">
          {t(lang, "connect.connected")}
        </p>
      ) : (
        <div className="mt-4">
          <button
            type="button"
            onClick={connect}
            disabled={view.kind === "connecting"}
            className="rounded-full bg-[#1e4d3d] px-5 py-2 text-sm font-semibold text-white transition hover:bg-[#18352d] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {view.kind === "connecting" ? t(lang, "form.working") : t(lang, "connect.connectButton")}
          </button>
          {error ? (
            <p role="alert" className="mt-3 text-sm text-[#8a5a12]">
              {error}
            </p>
          ) : null}
        </div>
      )}
    </section>
  );
}