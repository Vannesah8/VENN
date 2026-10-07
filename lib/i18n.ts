export const CURRENCIES = ["KES", "TZS", "UGX"] as const;
export type Currency = (typeof CURRENCIES)[number];

export const LANGS = ["en", "sw"] as const;
export type Lang = (typeof LANGS)[number];

export const COUNTRY_OF_CURRENCY: Record<Currency, string> = {
  KES: "KE",
  TZS: "TZ",
  UGX: "UG",
};

export const DEFAULT_CURRENCY: Currency = "KES";
export const DEFAULT_LANG: Lang = "en";

export const PREF_COOKIE = "venn_prefs";

export interface LocalePrefs {
  lang: Lang;
  currency: Currency;
}

export const DEFAULT_PREFS: LocalePrefs = { lang: DEFAULT_LANG, currency: DEFAULT_CURRENCY };

export function isCurrency(value: unknown): value is Currency {
  return typeof value === "string" && (CURRENCIES as readonly string[]).includes(value);
}

export function isLang(value: unknown): value is Lang {
  return typeof value === "string" && (LANGS as readonly string[]).includes(value);
}

export function parsePrefsCookie(value: string | undefined): LocalePrefs {
  if (!value) {
    return DEFAULT_PREFS;
  }

  try {
    const parsed = JSON.parse(value) as Partial<LocalePrefs>;
    const lang = isLang(parsed.lang) ? parsed.lang : DEFAULT_LANG;
    const currency = isCurrency(parsed.currency) ? parsed.currency : DEFAULT_CURRENCY;
    return { lang, currency };
  } catch {
    return DEFAULT_PREFS;
  }
}

export function serializePrefsCookie(prefs: LocalePrefs): string {
  return JSON.stringify(prefs);
}

export function localeFor(lang: Lang, currency: Currency): string {
  const country = COUNTRY_OF_CURRENCY[currency];
  return `${lang}-${country}`;
}

type StringParams = Record<string, string | number>;

const en = {
  "nav.home": "Home",
  "nav.escrow": "Escrow",
  "nav.dashboard": "Dashboard",
  "nav.signOut": "Sign out",
  "nav.wallet": "Wallet",
  "nav.language": "Language",
  "nav.currency": "Currency",

  "role.buyer": "Buyer",
  "role.seller": "Seller",
  "role.carrier": "Carrier",
  "role.mediator": "Support",

  "status.escrow_funded": "Escrow funded",
  "status.shipped": "Shipped",
  "status.in_transit": "In transit",
  "status.delivered": "Delivered",
  "status.released": "Released to seller",
  "status.disputed": "Dispute review",

  "action.dispatch.label": "Record shipment",
  "action.dispatch.description":
    "Attach a tracking number to hand the order to the carrier.",
  "action.scan_in_transit.label": "Mark in transit",
  "action.scan_in_transit.description": "Log the first carrier scan on the parcel.",
  "action.scan_milestone.label": "Log a scan",
  "action.scan_milestone.description": "Record a parcel scan with an optional milestone and photo.",
  "action.confirm_delivery.label": "Confirm delivery",
  "action.confirm_delivery.description": "Record that the parcel reached the buyer.",
  "action.confirm_receipt.label": "Confirm receipt",
  "action.confirm_receipt.description": "Buyer acknowledges the parcel is in hand.",
  "action.release_funds.label": "Release funds",
  "action.release_funds.description":
    "Buyer confirms the item and escrow pays the seller.",
  "action.open_dispute.label": "Open dispute",
  "action.open_dispute.description":
    "Buyer reports a problem and escrow is held for review.",
  "action.resolve_dispute.label": "Resolve dispute",
  "action.resolve_dispute.description": "Mediator closes the case and returns the order to the buyer.",
  "action.refund_buyer.label": "Refund the buyer",
  "action.refund_buyer.description": "Close the case and return the escrow to the buyer.",

  "milestone.picked_up": "Picked up",
  "milestone.at_depot": "At depot",
  "milestone.out_for_delivery": "Out for delivery",
  "milestone.attempted_delivery": "Delivery attempted",
  "action.tracking_required": "Tracking number, carrier, origin and destination are required to dispatch",

  "ledger.label.deposit": "Wallet deposit",
  "ledger.label.escrow_deposit": "Funds moved into escrow",
  "ledger.label.escrow_release": "Escrow released to seller",
  "ledger.label.seller_wallet": "seller wallet",
  "ledger.label.buyer_wallet": "buyer wallet",
  "ledger.label.escrow_holding": "escrow holding",

  "escrow.ledger": "Ledger",
  "escrow.heldByCustody": "Held by Venn custody",
  "escrow.noMoneyMoved": "No money has moved for this escrow yet.",
  "escrow.timeline": "Timeline",
  "escrow.escrowFunded": "Escrow funded",
  "escrow.shipment": "Shipment",
  "escrow.carrier": "Carrier",
  "escrow.origin": "Origin",
  "escrow.destination": "Destination",
  "escrow.carrierAccount": "Carrier account",
  "escrow.awaitingShipmentDetails": "Awaiting shipment details from the seller.",
  "escrow.availableActions": "Available actions",
  "escrow.notParty": "You are not a party to this transaction.",
  "escrow.noActions": "No actions are available to you on this transaction right now.",
  "escrow.backToAll": "All transactions",
  "escrow.buyer": "Buyer",
  "escrow.seller": "Seller",
  "escrow.escrowBalance": "Escrow balance",
  "escrow.noMoneyInEscrow": "No money has moved for this escrow yet.",

  "form.seller": "Seller",
  "form.item": "Item",
  "form.amount": "Amount ({currency})",
  "form.fundEscrow": "Fund escrow",
  "form.fundingEscrow": "Funding escrow...",
  "form.selectSeller": "Select a seller",
  "form.noSellers": "No seller accounts are available to trade with yet.",
  "form.trackingNumber": "Tracking number",
  "form.carrier": "Carrier",
  "form.carrierAccount": "Carrier account",
  "form.selectCarrier": "Select carrier",
  "form.origin": "Origin",
  "form.destination": "Destination",
  "form.note": "Note",
  "form.noteRequired": "(required for the case file)",
  "form.noteOptional": "(optional)",
  "form.working": "Working...",

  "party.buyer": "You are the buyer on this transaction.",
  "party.seller": "You are the seller on this transaction.",
  "party.carrier": "You are the assigned carrier on this transaction.",
  "party.mediator": "You are acting as support on this transaction.",

  "dashboard.eyebrow": "Operations",
  "dashboard.title": "Marketplace workspace",
  "dashboard.escrowHeld": "Escrow held",
  "dashboard.releasedToSellers": "Released to sellers",
  "dashboard.parcelsInFlight": "Parcels in flight",
  "dashboard.openDisputes": "Open disputes",
  "dashboard.yourTransactions": "Your transactions",
  "dashboard.viewAll": "View all",
  "dashboard.walletBalance": "Wallet balance",
  "dashboard.demoCashRail": "Demo cash rail · top up to fund escrow",
  "dashboard.addFunds": "Add funds",
  "dashboard.adding": "Adding...",
  "dashboard.withdraw": "Withdraw",
  "dashboard.withdrawAmount": "Amount to withdraw",
  "dashboard.withdrawToMpesa": "Mobile money number (optional)",
  "dashboard.needsAttention": "Needs your attention",
  "dashboard.noPendingActions": "No pending actions for {name}.",
  "dashboard.fundNewEscrow": "Fund a new escrow",
  "dashboard.fundHelp":
    "Funds move out of your wallet and stay held until you confirm delivery. Signed in as {role}.",
  "dashboard.nothingHere": "Nothing here yet. Fund an escrow below to get started.",

  "escrowIndex.eyebrow": "Trust layer",
  "escrowIndex.title": "Escrow transactions",
  "escrowIndex.all": "All",
  "escrowIndex.fundsHeld": "Funds held",
  "escrowIndex.awaitingConfirmation": "Awaiting confirmation",
  "escrowIndex.disputes": "Disputes",
  "escrowIndex.released": "Released",
  "escrowIndex.noTransactions": "No transactions match this filter.",
  "escrowIndex.updated": "Updated",

  "login.welcome": "Welcome back",
  "login.title": "Sign in to your account",
  "login.subtitle": "Escrow protection follows your identity, not a role switcher.",
  "login.email": "Email",
  "login.password": "Password",
  "login.phone": "Phone number",
  "login.otpCode": "Verification code",
  "login.signIn": "Sign in",
  "login.signingIn": "Signing in...",
  "login.requestCode": "Send code",
  "login.verify": "Verify code",
  "login.phoneMode": "Sign in with phone",
  "login.passwordMode": "Use email & password",
  "login.demoCode": "Demo SMS is on, so any code shown here works:",
  "login.noCode": "No code sent yet. Tap “Send code” first.",
  "login.invalidCredentials": "Invalid email or password",
  "login.demoAccounts":
    "Demo accounts are seeded with the password {password}. Run npm run seed to load them.",
  "login.signUpLink": "No account yet? Create one",

  "register.eyebrow": "New identity",
  "register.title": "Create an account",
  "register.subtitle": "Buyers fund escrow; sellers dispatch and get paid on release.",
  "register.name": "Name",
  "register.role": "Role",
  "register.password": "Password",
  "register.phone": "Phone number (optional)",
  "register.create": "Create account",
  "register.creating": "Creating account...",
  "register.signInLink": "Already signed up? Sign in",

  "otp.sent": "Code sent. Check your phone (demo: see the box above).",
  "otp.codeResent": "A fresh code was sent.",
  "otp.tooMany": "Too many attempts. Please wait a bit and try again.",

  "notification.transaction.created": "Escrow funded",
  "notification.shipment.dispatched": "Package shipped",
  "notification.shipment.in_transit": "Package in transit",
  "notification.delivery.confirmed": "Delivery confirmed",
  "notification.escrow.released": "Payment released",
  "notification.escrow.refunded": "Escrow refunded",
  "notification.dispute.opened": "Dispute opened",
  "notification.dispute.resolved": "Dispute resolved",

  "notifications.title": "Notifications",
  "notifications.empty": "No notifications yet.",
};

export type MessageKey = keyof typeof en;

const sw: Partial<Record<MessageKey, string | ((p: StringParams) => string)>> = {
  "nav.home": "Nyumbani",
  "nav.escrow": "Dhamana",
  "nav.dashboard": "Dashibodi",
  "nav.signOut": "Toka",
  "nav.wallet": "Pochi",
  "nav.language": "Lugha",
  "nav.currency": "Fedha",

  "role.buyer": "Mnunuzi",
  "role.seller": "Muuza",
  "role.carrier": "Msafirishaji",
  "role.mediator": "Msaada",

  "status.escrow_funded": "Dhamana imewekwa",
  "status.shipped": "Imesafirishwa",
  "status.in_transit": "Inasafirishwa",
  "status.delivered": "Imefikishwa",
  "status.released": "Imelipwa kwa muuzaji",
  "status.disputed": "Chini ya mapitio ya kesi",

  "action.dispatch.label": "Andika usafirishaji",
  "action.dispatch.description": "Weka namba ya kufuatilia ili kupeleka bidhaa kwa msafirishaji.",
  "action.scan_in_transit.label": "Weka kategoria ya usafiri",
  "action.scan_in_transit.description": "Rekodi uchunguzi wa kwanza wa sasisho la bidhaa.",
  "action.scan_milestone.label": "Rekodi uchunguzi",
  "action.scan_milestone.description": "Rekodi uchunguzi wa kifurushi pamoja na hatua na picha.",
  "action.confirm_delivery.label": "Thibitisha uwasilishaji",
  "action.confirm_delivery.description": "Rekodi kwamba kifurushi kimemfikia mnunuzi.",
  "action.confirm_receipt.label": "Thibitisha kupokea",
  "action.confirm_receipt.description": "Mnunuzi anathibitisha kifurushi kimefika mikononi mwake.",
  "action.release_funds.label": "Toa fedha",
  "action.release_funds.description": "Mnunuzi anathibitisha bidhaa na dhamana inamlipa muuzaji.",
  "action.open_dispute.label": "Fungua kesi",
  "action.open_dispute.description": "Mnunuzi anaripoti tatizo na dhamana inashikiliwa kwa mapitio.",
  "action.resolve_dispute.label": "Suluhisha kesi",
  "action.resolve_dispute.description": "Msimamizi anafunga kesi na kurudisha agizo kwa mnunuzi.",
  "action.refund_buyer.label": "Mrejeshee mnunuzi fedha",
  "action.refund_buyer.description": "Funga kesi na urudishe dhamana kwa mnunuzi.",

  "milestone.picked_up": "Imechukuliwa",
  "milestone.at_depot": "Kwenye bohari",
  "milestone.out_for_delivery": "Njiani kuelekea kwa mpokeaji",
  "milestone.attempted_delivery": "Uwasilishaji ulijaribiwa",
  "action.tracking_required": "Namba ya kufuatilia, msafirishaji, asili na lengwa vinahitajika",

  "ledger.label.deposit": "Amana ya pochi",
  "ledger.label.escrow_deposit": "Fedha zilihamishiwa dhamanani",
  "ledger.label.escrow_release": "Dhamana imetolewa kwa muuzaji",
  "ledger.label.seller_wallet": "pochu ya muuzaji",
  "ledger.label.buyer_wallet": "pochi ya mnunuzi",
  "ledger.label.escrow_holding": "fedha za dhamana",

  "escrow.ledger": "Daftari la fedha",
  "escrow.heldByCustody": "Kwenye udhamini wa Venn",
  "escrow.noMoneyMoved": "Hakuna fedha zilizohamishwa kwa dhamana hii bado.",
  "escrow.timeline": "Mlolongo wa matukio",
  "escrow.escrowFunded": "Dhamana imewekwa",
  "escrow.shipment": "Usafirishaji",
  "escrow.carrier": "Msafirishaji",
  "escrow.origin": "Asili",
  "escrow.destination": "Lengwa",
  "escrow.carrierAccount": "Akaunti ya msafirishaji",
  "escrow.awaitingShipmentDetails": "Kusubiri maelezo ya usafirishaji kutoka kwa muuzaji.",
  "escrow.availableActions": "Vitendo vinavyopatikana",
  "escrow.notParty": "Wewe si mshiriki wa dhamana hii.",
  "escrow.noActions": "Hakuna vitendo vinavyopatikana kwako kwenye dhamana hii sasa.",
  "escrow.backToAll": "Dhamana zote",
  "escrow.buyer": "Mnunuzi",
  "escrow.seller": "Muuza",
  "escrow.escrowBalance": "Salio la dhamana",

  "form.seller": "Muuza",
  "form.item": "Bidhaa",
  "form.amount": "Kiasi ({currency})",
  "form.fundEscrow": "Fadhili dhamana",
  "form.fundingEscrow": "Inafadhili dhamana...",
  "form.selectSeller": "Chagua muuzaji",
  "form.noSellers": "Hakuna akaunti za wauzaji zinazopatikana bado.",
  "form.trackingNumber": "Namba ya kufuatilia",
  "form.carrier": "Msafirishaji",
  "form.carrierAccount": "Akaunti ya msafirishaji",
  "form.selectCarrier": "Chagua msafirishaji",
  "form.origin": "Asili",
  "form.destination": "Lengwa",
  "form.note": "Dokezo",
  "form.noteRequired": "(inahitajika kwa file la kesi)",
  "form.noteOptional": "(hiari)",
  "form.working": "Inafanyika...",

  "party.buyer": "Wewe ndiye mnunuzi wa dhamana hii.",
  "party.seller": "Wewe ndiye muuzaji wa dhamana hii.",
  "party.carrier": "Wewe ndiye msafirishaji aliyetengwa wa dhamana hii.",
  "party.mediator": "Wewe unasimamia dhamana hii kama msaada.",

  "dashboard.eyebrow": "Uendeshaji",
  "dashboard.title": "Sehemu ya kazi ya soko",
  "dashboard.escrowHeld": "Dhamana inayoshikiliwa",
  "dashboard.releasedToSellers": "Imelipwa kwa wauzaji",
  "dashboard.parcelsInFlight": "Vifurushi vinavyosafiri",
  "dashboard.openDisputes": "Kesi zilizo wazi",
  "dashboard.yourTransactions": "Dhamana zako",
  "dashboard.viewAll": "Ona zote",
  "dashboard.walletBalance": "Salio la pochi",
  "dashboard.demoCashRail": "Mfumo wa majaribio wa fedha · jaza pochi kufadhili dhamana",
  "dashboard.addFunds": "Ongeza fedha",
  "dashboard.adding": "Inaongeza...",
  "dashboard.withdraw": "Toa",
  "dashboard.withdrawAmount": "Kiasi cha kutoa",
  "dashboard.withdrawToMpesa": "Namba ya simu ya mobile money (hiari)",
  "dashboard.needsAttention": "Inahitaji umakini wako",
  "dashboard.noPendingActions": "Hakuna vitendo vya {name} sasa.",
  "dashboard.fundNewEscrow": "Fadhili dhamana mpya",
  "dashboard.fundHelp":
    "Fedha zinatoka kwenye pochi yako na kubaki zikishikiliwa hadi uthibitishe uwasilishaji. Umeingia kama {role}.",
  "dashboard.nothingHere": "Bado hakuna dhamana. Fadhili moja hapa chini kuanza.",

  "escrowIndex.eyebrow": "Safu ya uaminifu",
  "escrowIndex.title": "Dhamana za biashara",
  "escrowIndex.all": "Zote",
  "escrowIndex.fundsHeld": "Fedha zinazoshikiliwa",
  "escrowIndex.awaitingConfirmation": "Kusubiri uthibitisho",
  "escrowIndex.disputes": "Kesi",
  "escrowIndex.released": "Zilizolipwa",
  "escrowIndex.noTransactions": "Hakuna dhamana inayolingana na kichujio hiki.",
  "escrowIndex.updated": "Imesasishwa",

  "login.welcome": "Karibu tena",
  "login.title": "Ingia kwenye akaunti yako",
  "login.subtitle": "Ulinzi wa dhamana unafuata utambulisho wako, si swichi ya jukumu.",
  "login.email": "Barua pepe",
  "login.password": "Nywila",
  "login.phone": "Namba ya simu",
  "login.otpCode": "Namba ya uthibitisho",
  "login.signIn": "Ingia",
  "login.signingIn": "Inaingiza...",
  "login.requestCode": "Tuma namba",
  "login.verify": "Thibitisha namba",
  "login.phoneMode": "Ingia kwa namba ya simu",
  "login.passwordMode": "Tumia barua pepe na nywila",
  "login.demoCode": "SMS ya majaribio imewashwa; namba yoyote hapa inatumika:",
  "login.noCode": "Namba haijatumwa bado. Bonyeza “Tuma namba” kwanza.",
  "login.invalidCredentials": "Barua pepe au nywila si sahihi",
  "login.demoAccounts":
    "Akaunti za majaribio zina nywila {password}. Endesha npm run seed kuzipakia.",
  "login.signUpLink": "Huna akaunti? Unda moja",

  "register.eyebrow": "Utambulisho mpya",
  "register.title": "Unda akaunti",
  "register.subtitle": "Wanunuzi wanaweka dhamana; wauzaji husafirisha na kulipwa baada ya kutolewa.",
  "register.name": "Jina",
  "register.role": "Jukumu",
  "register.password": "Nywila",
  "register.phone": "Namba ya simu (hiari)",
  "register.create": "Unda akaunti",
  "register.creating": "Inaunda akaunti...",
  "register.signInLink": "Una akaunti tayari? Ingia",

  "otp.sent": "Namba imetumwa. Angalia simu yako (majaribio: tazama kisanduku hapo juu).",
  "otp.codeResent": "Namba mpya imetumwa.",
  "otp.tooMany": "Majamba mengi sana. Subiri kidogo kisha jaribu tena.",

  "notification.transaction.created": "Dhamana imewekwa",
  "notification.shipment.dispatched": "Kifurushi kimesafirishwa",
  "notification.shipment.in_transit": "Kifurushi kinasafirishwa",
  "notification.delivery.confirmed": "Uwasilishaji umethibitishwa",
  "notification.escrow.released": "Malipo yametolewa",
  "notification.escrow.refunded": "Dhamana imerejeshwa",
  "notification.dispute.opened": "Kesi imefunguliwa",
  "notification.dispute.resolved": "Kesi imesuluhishwa",

  "notifications.title": "Arifa",
  "notifications.empty": "Hakuna arifa bado.",
};

type SwEntry = Partial<Record<MessageKey, string | ((p: StringParams) => string)>>;

function bodyFor(entry: string | ((p: StringParams) => string), params: StringParams): string {
  return typeof entry === "function" ? entry(params) : entry;
}

function render(entry: string, params: StringParams): string {
  return entry.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in params ? String(params[key]) : match,
  );
}

export function t(lang: Lang, key: MessageKey, params: StringParams = {}): string {
  const translation = (sw as SwEntry)[key];
  const source = en[key];

  if (lang === "en") {
    return render(source, params);
  }

  if (translation !== undefined) {
    return render(bodyFor(translation, params), params);
  }

  return render(source, params);
}

interface NotificationPattern {
  title: (lang: Lang, p: StringParams) => string;
  body: (lang: Lang, p: StringParams) => string;
}

const NOTIFICATION_PATTERNS = {
  "notification.transaction.created": {
    title: (lang: Lang) => t(lang, "notification.transaction.created"),
    body: (lang: Lang, p: StringParams) =>
      lang === "sw"
        ? `${p.item} inalindwa kwenye dhamana. Muuzaji: ${p.seller}.`
        : `${p.item} is protected in escrow. Seller: ${p.seller}.`,
  },
  "notification.shipment.dispatched": {
    title: (lang: Lang, p: StringParams) => t(lang, "notification.shipment.dispatched", p),
    body: (lang: Lang, p: StringParams) =>
      lang === "sw"
        ? `${p.item} imesafirishwa (${p.tracking}). ${p.from} → ${p.to}.`
        : `${p.item} is on its way (${p.tracking}). ${p.from} → ${p.to}.`,
  },
  "notification.shipment.in_transit": {
    title: (lang: Lang, p: StringParams) => t(lang, "notification.shipment.in_transit", p),
    body: (lang: Lang, p: StringParams) =>
      lang === "sw"
        ? `${p.item} iko njiani kuelekea ${p.to}.`
        : `${p.item} is moving toward ${p.to}.`,
  },
  "notification.delivery.confirmed": {
    title: (lang: Lang, p: StringParams) => t(lang, "notification.delivery.confirmed", p),
    body: (lang: Lang, p: StringParams) =>
      lang === "sw"
        ? `${p.item} imefikishwa. Mnunuzi anaweza kutoa fedha sasa.`
        : `${p.item} has arrived. The buyer can now release funds.`,
  },
  "notification.escrow.released": {
    title: (lang: Lang, p: StringParams) => t(lang, "notification.escrow.released", p),
    body: (lang: Lang, p: StringParams) =>
      lang === "sw"
        ? `${p.amount} zimetolewa kutoka dhamana ya ${p.item}.`
        : `${p.amount} has been released from escrow for ${p.item}.`,
  },
  "notification.escrow.refunded": {
    title: (lang: Lang, p: StringParams) => t(lang, "notification.escrow.refunded", p),
    body: (lang: Lang, p: StringParams) =>
      lang === "sw"
        ? `${p.amount} zimerejeshwa kwa mnunuzi kutoka dhamana ya ${p.item}.`
        : `${p.amount} has been refunded to the buyer from the escrow for ${p.item}.`,
  },
  "notification.dispute.opened": {
    title: (lang: Lang, p: StringParams) => t(lang, "notification.dispute.opened", p),
    body: (lang: Lang, p: StringParams) =>
      lang === "sw"
        ? `Kesi imefunguliwa kwenye ${p.item}. Fedha zimebakia kwenye dhamana.`
        : `A dispute has been opened on ${p.item}. Funds remain in escrow.`,
  },
  "notification.dispute.resolved": {
    title: (lang: Lang, p: StringParams) => t(lang, "notification.dispute.resolved", p),
    body: (lang: Lang, p: StringParams) =>
      lang === "sw"
        ? `Kesi ya ${p.item} imesuluhishwa.`
        : `The dispute on ${p.item} has been resolved.`,
  },
} satisfies Partial<Record<MessageKey, NotificationPattern>>;

export type NotificationKey = keyof typeof NOTIFICATION_PATTERNS;

export function isNotificationKey(value: string): value is NotificationKey {
  return value in NOTIFICATION_PATTERNS;
}

export function renderNotification(
  key: NotificationKey,
  lang: Lang,
  params: StringParams,
): { title: string; body: string } {
  const pattern = NOTIFICATION_PATTERNS[key];
  return {
    title: pattern.title(lang, params),
    body: pattern.body(lang, params),
  };
}