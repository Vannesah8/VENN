import { getDatabase, type DbLike } from "@/lib/db";
import type { EscrowEvent, EscrowRole, EscrowTransaction } from "@/lib/escrow";
import {
  DEFAULT_LANG,
  isNotificationKey,
  renderNotification,
  type Lang,
  type NotificationKey,
} from "@/lib/i18n";
import { enqueueOutbox, processOutbox, type OutboxJob } from "@/lib/outbox";

/**
 * SMS delivery seam. The demo provider logs to the console (no external
 * credentials); the Africa's Talking provider activates when AT_USERNAME and
 * AT_API_KEY are set, and can target the AT sandbox with AT_SANDBOX=1.
 */
export interface SmsProvider {
  readonly isDemo: boolean;
  sendSms(to: string, text: string): Promise<void>;
}

export function demoSmsProvider(): SmsProvider {
  return {
    isDemo: true,
    async sendSms(to, text) {
      console.log(`[Venn demo SMS] ${to}: ${text}`);
    },
  };
}

export function atSmsProvider(): SmsProvider {
  const username = process.env.AT_USERNAME ?? "";
  const apiKey = process.env.AT_API_KEY ?? "";
  const from = process.env.AT_SENDER_ID ?? "";
  const sandbox = process.env.AT_SANDBOX === "1";
  const host = sandbox ? "https://api.sandbox.africastalking.com" : "https://api.africastalking.com";

  return {
    isDemo: false,
    async sendSms(to, text) {
      const body = new URLSearchParams({ username, to, message: text });
      if (from) {
        body.set("from", from);
      }

      const response = await fetch(`${host}/version1/messaging`, {
        method: "POST",
        headers: {
          apikey: apiKey,
          Accept: "application/json",
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body,
      });

      if (!response.ok) {
        throw new Error(`Africa's Talking SMS request failed (${response.status})`);
      }
    },
  };
}

export function getSmsProvider(): SmsProvider {
  if (process.env.AT_USERNAME && process.env.AT_API_KEY) {
    return atSmsProvider();
  }
  return demoSmsProvider();
}

export function isSmsDemo(): boolean {
  return !(process.env.AT_USERNAME && process.env.AT_API_KEY);
}

export interface NotificationJobPayload {
  toUserId: string;
  toRole: EscrowRole;
  key: NotificationKey;
  params: Record<string, string>;
}

export interface NotificationView {
  id: number;
  title: string;
  body: string;
  createdAt: Date;
}

interface UserNotifyRow {
  id: string;
  lang: string | null;
  phone: string | null;
}

/** Marks a recipient to be notified once the outbox drains. Runs inside the caller's transaction. */
export async function enqueueNotification(
  toUserId: string,
  toRole: EscrowRole,
  key: NotificationKey,
  params: Record<string, string>,
  db: DbLike = getDatabase(),
): Promise<void> {
  const d = await db;
  const payload: NotificationJobPayload = { toUserId, toRole, key, params };
  await enqueueOutbox("notification", payload, d);
}

const TRANSITION_KEYS: Partial<Record<EscrowEvent["action"], NotificationKey>> = {
  created: "notification.transaction.created",
  dispatch: "notification.shipment.dispatched",
  scan_in_transit: "notification.shipment.in_transit",
  confirm_delivery: "notification.delivery.confirmed",
  release_funds: "notification.escrow.released",
  refund_buyer: "notification.escrow.refunded",
  open_dispute: "notification.dispute.opened",
  resolve_dispute: "notification.dispute.resolved",
};

function paramsFor(
  transaction: EscrowTransaction,
  d: { get<T>(sql: string, params?: unknown[]): Promise<T | undefined> },
): Promise<Record<string, string>> {
  return (async () => {
    const partyName = async (id: string): Promise<string> => {
      const row = await d.get<{ display_name: string }>(
        "SELECT display_name FROM users WHERE id = ?",
        [id],
      );
      return row?.display_name ?? id;
    };

    const [sellerName, buyerName] = await Promise.all([
      partyName(transaction.sellerId),
      partyName(transaction.buyerId),
    ]);

    const amountLabel = new Intl.NumberFormat("en-KE", {
      style: "currency",
      currency: transaction.currency,
      maximumFractionDigits: 2,
    }).format(transaction.amountCents / 100);

    return {
      item: transaction.itemName,
      seller: sellerName,
      buyer: buyerName,
      amount: amountLabel,
      tracking: transaction.trackingNumber ?? "",
      from: transaction.origin ?? "",
      to: transaction.destination ?? "",
    };
  })();
}

/**
 * Enqueues status pings for both parties of an escrow whenever the state
 * machine advances, so everyone watching the same transaction sees the record.
 */
export async function enqueueTransitionNotifications(
  transaction: EscrowTransaction,
  action: EscrowEvent["action"],
  db: DbLike = getDatabase(),
): Promise<void> {
  const key = TRANSITION_KEYS[action];
  if (!key) {
    return;
  }

  const d = await db;
  const params = await paramsFor(transaction, d);
  const parties: Array<{ userId: string; role: EscrowRole }> = [
    { userId: transaction.buyerId, role: "buyer" },
    { userId: transaction.sellerId, role: "seller" },
  ];

  for (const party of parties) {
    if (key === "notification.escrow.released" && party.role === "buyer") {
      continue; // only the seller hears about the payout
    }
    await enqueueNotification(party.userId, party.role, key, params, d);
  }
}

export async function listNotifications(
  userId: string,
  db: DbLike = getDatabase(),
): Promise<NotificationView[]> {
  const d = await db;
  const rows = await d.all<{
    id: number;
    title: string;
    body: string;
    created_at: string;
  }>(
    "SELECT id, title, body, created_at FROM notifications WHERE user_id = ? ORDER BY id DESC LIMIT 10",
    [userId],
  );

  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    body: row.body,
    createdAt: new Date(row.created_at),
  }));
}

/**
 * Drains notification jobs from the outbox: renders the message in the
 * recipient's preferred language, files an in-app copy, and attempts SMS.
 */
export async function processNotifications(
  db: DbLike = getDatabase(),
): Promise<{ processed: number; succeeded: number; failed: number }> {
  const d = await db;

  return processOutbox(
    async (job: OutboxJob) => {
      if (job.topic !== "notification") {
        return;
      }

      const payload = job.payload as NotificationJobPayload;

      if (!payload || !payload.toUserId || !isNotificationKey(payload.key)) {
        return;
      }

      const user = await d.get<UserNotifyRow>(
        "SELECT id, lang, phone FROM users WHERE id = ?",
        [payload.toUserId],
      );

      if (!user) {
        return;
      }

      const lang: Lang = user.lang === "sw" ? "sw" : DEFAULT_LANG;
      const message = renderNotification(payload.key, lang, payload.params);

      await d.run(
        "INSERT INTO notifications (user_id, title, body, created_at) VALUES (?, ?, ?, ?)",
        [user.id, message.title, message.body, new Date().toISOString()],
      );

      const sms = getSmsProvider();

      if (user.phone) {
        await sms.sendSms(user.phone, `${message.title} — ${message.body}`);
      }
    },
    { limit: 50 },
    d,
  );
}