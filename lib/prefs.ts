import { cookies } from "next/headers";

import {
  DEFAULT_PREFS,
  PREF_COOKIE,
  parsePrefsCookie,
  serializePrefsCookie,
  type LocalePrefs,
} from "@/lib/i18n";

export async function getPrefsFromCookies(): Promise<LocalePrefs> {
  const cookieStore = await cookies();
  return parsePrefsCookie(cookieStore.get(PREF_COOKIE)?.value);
}

export async function setPrefsCookie(prefs: LocalePrefs): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(PREF_COOKIE, serializePrefsCookie(prefs), {
    httpOnly: false,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    secure: process.env.NODE_ENV === "production",
  });
}

export async function clearPrefsCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(PREF_COOKIE);
}

export { DEFAULT_PREFS };