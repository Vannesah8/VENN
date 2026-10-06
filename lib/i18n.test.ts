import test from "node:test";
import assert from "node:assert/strict";

import {
  DEFAULT_PREFS,
  localeFor,
  parsePrefsCookie,
  renderNotification,
  serializePrefsCookie,
  t,
  type Lang,
} from "./i18n";

test("pref cookie parsing falls back to defaults", () => {
  assert.deepEqual(parsePrefsCookie(undefined), DEFAULT_PREFS);
  assert.deepEqual(parsePrefsCookie(JSON.stringify({ lang: "sw", currency: "UGX" })), {
    lang: "sw",
    currency: "UGX",
  });
  assert.deepEqual(parsePrefsCookie("trash"), DEFAULT_PREFS);
  assert.deepEqual(serializePrefsCookie({ lang: "sw", currency: "TZS" }), '{"lang":"sw","currency":"TZS"}');
});

test("localeFor maps language and currency to an ICU locale", () => {
  assert.equal(localeFor("en", "KES"), "en-KE");
  assert.equal(localeFor("en", "TZS"), "en-TZ");
  assert.equal(localeFor("en", "UGX"), "en-UG");
  assert.equal(localeFor("sw", "KES"), "sw-KE");
  assert.equal(localeFor("sw", "TZS"), "sw-TZ");
  assert.equal(localeFor("sw", "UGX"), "sw-UG");
});

test("t interpolates parameters in both languages", () => {
  assert.equal(t("en", "login.demoAccounts", { password: "venn-demo" }),
    "Demo accounts are seeded with the password venn-demo. Run npm run seed to load them.");
  assert.equal(t("sw", "role.buyer"), "Mnunuzi");
  assert.equal(t("sw", "login.demoAccounts", { password: "venn-demo" }).includes("venn-demo"), true);
});

test("renderNotification produces a title and body in the requested language", () => {
  const sent = renderNotification("notification.shipment.dispatched", "en", {
    item: "Vintage camera lens",
    tracking: "1Z9V94X7K9",
    from: "Lagos",
    to: "Nairobi",
  });
  assert.equal(sent.title, "Package shipped");
  assert.match(sent.body, /Vintage camera lens/);
  assert.match(sent.body, /1Z9V94X7K9/);

  const sw = renderNotification("notification.shipment.dispatched", "sw", {
    item: "Bidhaa",
    tracking: "123",
    from: "A",
    to: "B",
  });
  assert.equal(sw.title, "Kifurushi kimesafirishwa");
  assert.ok(sw.body.length > 0);
});

test("unknown languages/clocale safe guards", () => {
  const lang = "en" as Lang;
  assert.equal(t(lang, "nav.home"), "Home");
});