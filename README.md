# Venn

Escrow and delivery tracking for social-media commerce. Funds are held by the platform until
delivery is confirmed, and every state change is recorded in an immutable audit trail.

## Stack

- Next.js 16 (App Router, Turbopack) + React 19 + Tailwind 4
- Storage is **dual-driver**: SQLite via `better-sqlite3` (WAL mode) by default, Postgres via `pg`
  when `VENN_DB_URL` is set — one async adapter (`lib/db.ts`) speaks to both
- Swahili + English UI with a KES/TZS/UGX display-currency toggle
- Phone sign-in with 6-digit OTP codes, SMS notifications through an Africa's Talking seam
- `node:test` through `tsx`; the same suite runs against both drivers

## Getting started

```bash
npm install
npm run seed        # load demo accounts, wallets and transactions
npm run dev
```

Then open http://localhost:3000/login. Every seeded account uses the password `venn-demo`, or sign
in by phone (any seeded phone) and request a code — demo SMS mode prints the code to the server log:

| Email                    | Role    | Phone          |
| ------------------------ | ------- | -------------- |
| `buyer_aisha@venn.demo`  | Buyer   | `+254712000001`|
| `buyer_juma@venn.demo`   | Buyer   | `+254712000002`|
| `seller_keisha@venn.demo`| Seller  | `+254712000003`|
| `seller_kofi@venn.demo`  | Seller  | `+254712000004`|
| `carrier_fedex@venn.demo`| Carrier | `+254712000005`|
| `carrier_dhl@venn.demo`  | Carrier | `+254712000006`|
| `support@venn.demo`      | Support | `+254712000007`|

`npm run seed -- --reset` rebuilds the demo data set from scratch. Existing databases are migrated
in place (columns and tables are added, nothing is dropped).

### Postgres instead of SQLite

```bash
npm run db:up        # docker compose up -d postgres (db/user venn, password venn)
VENN_DB_URL=postgres://venn:venn@localhost:5432/venn npm run seed -- --reset
VENN_DB_URL=postgres://venn:venn@localhost:5432/venn npm run dev
```

Reads and writes are identical either way; the tests run against both:

```bash
npm test             # SQLite (in-memory)
npm run test:postgres
```

## Scripts

| Script              | Purpose                                    |
| ------------------- | ------------------------------------------ |
| `npm run dev`       | Development server                         |
| `npm run build`     | Production build                           |
| `npm run start`     | Serve a production build                   |
| `npm run seed`      | Create the demo accounts and transactions  |
| `npm run seed:reset`| Rebuild the demo set from scratch          |
| `npm run db:up`     | Start the Postgres container (Docker)      |
| `npm run worker`    | Background outbox drain (see below)        |
| `npm run worker:once`| Run one outbox drain pass and exit        |
| `npm test`          | Suite against SQLite                       |
| `npm run test:postgres` | Suite against Postgres                 |
| `npm run lint`      | ESLint                                    |
| `npm run typecheck` | `tsc --noEmit`                            |

## The escrow state machine

`lib/escrow.ts` is the single source of truth. A client can never set a status directly — it asks
for an **action**, and the machine decides whether that action is legal for the actor's role and the
transaction's current status.

```
                dispatch (seller)
  escrow_funded ──────────────────▶ shipped
        ▲                             │ scan_in_transit (seller | carrier)
        │                             ▼
        │                        in_transit
        │                             │ confirm_delivery (seller | carrier)
        │                             ▼
        │                          delivered ──open_dispute (buyer)──▶ disputed
        │                             ▲                                      │
        │                             └────resolve_dispute (support)─────────┘
        │
        └──────── release_funds (buyer) ◀── delivered
```

Rules the machine enforces:

- No status skipping. `escrow_funded → released` is rejected with `409`.
- Only the **buyer** releases funds or opens a dispute — never the seller.
- Only the **seller** dispatches, and a dispatch requires tracking number, carrier, origin and
  destination.
- Only the **assigned** carrier can scan; the carrier must not be the buyer or the seller.
- Only **support** (mediator) can close a dispute, returning the order to `delivered`.
- `released` is terminal.
- Read access is scoped too: buyers, sellers, the assigned carrier and support can view a
  transaction; everyone else gets `404`.

Money is stored as integer cents and parsed defensively, so no floating point drift reaches escrow
balances. Funds move through a double-entry ledger described below.

## The money flow

`lib/ledger.ts` is a small double-entry ledger. Every user owns a `wallet` account and every escrow
has its own holding `account`. Balances are never stored — they are the running sum of an append-only
`ledger_entries` table, so a movement can be audited down to the cent.

- **Funding**: `createTransaction` debits the buyer's wallet and credits the escrow holding in the
  same transaction (SQLite or Postgres). A buyer without enough balance is rejected
  (`insufficient_funds`) and nothing is written.
- **Release**: `release_funds` settles the escrow holding to the seller's wallet. It happens inside
  the same transaction that flips the status, so the payout can never be separated from the state
  change.
- **Disputes**: funds stay in the escrow holding until the case is resolved and the buyer releases.
- **Top-ups**: `depositWalletFunds` is the only way money enters the system. Today it is a demo
  "cash rail" (the dashboard's *Add funds* card); it is the seam where a real gateway (Stripe,
  M-Pesa, ACH) would be wired in.
- **Snapshot balances**: wallets keep a denormalized `balance_cents` snapshot (maintained in the same
  transaction as the ledger entries) for cheap reads, while `ledger_entries` stays the append-only
  source of truth for auditing.

Ledger entries carry a `reference_id` linking each leg back to the transaction, and the escrow
detail page renders both legs of every movement.

## Authentication

Auth is real, not a role switcher. `/login` and `/register` use server actions backed by
`lib/session.ts`:

- Passwords are hashed with `scrypt` (per-user salt, constant-time compare) in `lib/auth.ts`.
- Sessions are database rows (`sessions` table) referenced by an httpOnly cookie containing a
  random token; only the token hash is stored. Sessions expire after 30 days and are pruned when
  they expire.
- **Phone OTP**: `/login` also accepts a phone number. `issueOtp` (in `lib/otp.ts`) stores a
  hashed 6-digit code that expires after 10 minutes and burns out after 5 wrong attempts; verifying
  a valid code signs in (creating a buyer account on first use). In demo mode the code is returned
  to the caller and printed by the SMS seam — set `AT_USERNAME`/`AT_API_KEY` to send real SMS.
- **Rate limiting**: `login` actions are throttled per identity (10 per 15 minutes, 5 for OTP
  requests) in `lib/rate-limit.ts` using a sliding set of counted windows.
- Every page/action resolves the actor from the session and re-checks authorization against the
  state machine. `/register` creates buyer or seller identities; carrier and support accounts are
  seeded/managed.
- Route handlers authenticate through the same cookie (sameSite=Lax), returning `401` when absent.

## Notifications and the outbox

Every state change enqueues a notification job **inside the same transaction** as the event it
describes (`enqueueTransitionNotifications` in `lib/notifications.ts`). A background drain
(`processNotifications`, or `npm run worker` for the standalone poller) then:

- files an in-app copy of the message, rendered in each user's preferred language (`en`/`sw`), and
- sends an SMS when the user has a phone.

SMS goes through a provider seam: the default logs to the console (ideal for development), and
turning on `AT_USERNAME` + `AT_API_KEY` switches to Africa's Talking (`AT_SENDER_ID` optional,
`AT_SANDBOX=1` for the sandbox). Because the job commits with the state change, a crash mid-drain
cannot lose or duplicate notifications — jobs are claimed transactionally and marked `sent`/`failed`
on the row. Server actions also drain inline after they commit, so pings appear without the worker.

## Locale preferences

Signed-in users can switch language (`en`/`sw`) and display currency (`KES`/`TZS`/`UGX`) from the
session bar (`PrefToggle`). The choice is persisted to the `users` row (and to a readable
`venn_prefs` cookie for guests), and money formatting follows it — stored amounts are always integer
cents.

## Data model

| Table             | Purpose                                              |
| ----------------- | ---------------------------------------------------- |
| `users`           | Accounts with a role, email, `scrypt` hash, phone, `lang` and `currency` |
| `sessions`        | Login sessions (token hash, expiry)                  |
| `transactions`    | Current state of each escrow                         |
| `escrow_events`   | Append-only audit trail of every state change        |
| `ledger_accounts` | Wallets (per user) and holdings (per escrow), incl. a `balance_cents` snapshot |
| `ledger_entries`  | Append-only double-entry money movements             |
| `notifications`   | In-app copies of outbound messages per user          |
| `outbox`          | Reliable outbound jobs (`notification`, …)           |
| `otp_codes`       | Hashed one-time codes with expiry and attempt counts |
| `rate_limits`     | Sliding counted windows for login / OTP throttling   |

Reads and writes go through `lib/transactions.ts`. Each action runs inside a single database
transaction that validates, updates the row and appends the event, so a rejected action leaves no
partial write and two concurrent releases cannot both succeed.

The database lives at `data/venn.db` (override with `VENN_DB_FILE`); set `VENN_DB_URL` to use
Postgres instead.

## HTTP API

All routes resolve the actor from the `venn_session` cookie and enforce the state machine. Without
a valid session they return `401`.

| Method | Path                          | Purpose                                  |
| ------ | ----------------------------- | ---------------------------------------- |
| GET    | `/api/health`                 | Liveness and transaction count           |
| GET    | `/api/transactions`           | Transactions the actor is a party to (cookie jar pagination via `?cursor=&limit=`) |
| POST   | `/api/transactions`           | Buyer opens a new escrow                 |
| GET    | `/api/transactions/[id]`      | One transaction plus its event trail     |
| PATCH  | `/api/transactions/[id]`      | Run one action: `{ "action": "dispatch", ... }` |

Actions: `dispatch`, `scan_in_transit`, `confirm_delivery`, `release_funds`, `open_dispute`,
`resolve_dispute`. Errors carry a machine-readable `code` and map to `400`, `403`, `404`, or `409`.

## Not yet built

- **Real payment gateway**: `depositWalletFunds` mints wallet credit from a demo rail. Wire it to
  Stripe/M-Pesa/ACH and the rest of the ledger, escrow accounting and payouts already work.
- **Real SMS at scale**: the Africa's Talking seam is implemented and sandbox-tested, but delivery
  volume, retry backoff and provider-side callbacks are not yet tuned.
- **Ledger scalability**: balances now have a snapshot column, but high-volume workloads should
  move pagination and snapshot maintenance onto a balances table + scheduled aggregation.

Notably, the escrow state machine, role authorization, the audit trail, the double-entry ledger,
phone OTP sign-in and the outbox are all real and tested — the pieces above are operational, not
conceptual, gaps.