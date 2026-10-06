# Venn

Escrow and delivery tracking for social-media commerce. Funds are held by the platform until
delivery is confirmed, and every state change is recorded in an immutable audit trail.

## Stack

- Next.js 16 (App Router, Turbopack) + React 19 + Tailwind 4
- SQLite via `better-sqlite3` (WAL mode)
- `node:test` through `tsx`

## Getting started

```bash
npm install
npm run seed        # load demo accounts, wallets and transactions
npm run dev
```

Then open http://localhost:3000/login and sign in. Every seeded account uses the password
`venn-demo` — the accounts are:

| Email                    | Role    |
| ------------------------ | ------- |
| `buyer_aisha@venn.demo`  | Buyer   |
| `buyer_juma@venn.demo`   | Buyer   |
| `seller_keisha@venn.demo`| Seller  |
| `seller_kofi@venn.demo`  | Seller  |
| `carrier_fedex@venn.demo`| Carrier |
| `carrier_dhl@venn.demo`  | Carrier |
| `support@venn.demo`      | Support |

`npm run seed -- --reset` rebuilds the demo data set from scratch. Existing databases are migrated
in place (columns and tables are added, nothing is dropped).

## Scripts

| Script              | Purpose                                    |
| ------------------- | ------------------------------------------ |
| `npm run dev`       | Development server                         |
| `npm run build`     | Production build                           |
| `npm run seed`      | Create the demo accounts and transactions  |
| `npm test`          | Unit and repository tests                  |
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
  same SQLite transaction. A buyer without enough balance is rejected (`insufficient_funds`) and
  nothing is written.
- **Release**: `release_funds` settles the escrow holding to the seller's wallet. It happens inside
  the same transaction that flips the status, so the payout can never be separated from the state
  change.
- **Disputes**: funds stay in the escrow holding until the case is resolved and the buyer releases.
- **Top-ups**: `depositWalletFunds` is the only way money enters the system. Today it is a demo
  "cash rail" (the dashboard's *Add funds* card); it is the seam where a real gateway (Stripe,
  M-Pesa, ACH) would be wired in.

Ledger entries carry a `reference_id` linking each leg back to the transaction, and the escrow
detail page renders both legs of every movement.

## Authentication

Auth is real, not a role switcher. `/login` and `/register` use server actions backed by
`lib/session.ts`:

- Passwords are hashed with `scrypt` (per-user salt, constant-time compare) in `lib/auth.ts`.
- Sessions are database rows (`sessions` table) referenced by an httpOnly cookie containing a
  random token; only the token hash is stored. Sessions expire after 30 days and are pruned when
  they expire.
- Every page/action resolves the actor from the session and re-checks authorization against the
  state machine. `/register` creates buyer or seller identities; carrier and support accounts are
  seeded/managed.
- Route handlers authenticate through the same cookie (sameSite=Lax), returning `401` when absent.

## Data model

| Table             | Purpose                                              |
| ----------------- | ---------------------------------------------------- |
| `users`           | Accounts with a role, email and `scrypt` hash        |
| `sessions`        | Login sessions (token hash, expiry)                  |
| `transactions`    | Current state of each escrow                         |
| `escrow_events`   | Append-only audit trail of every state change        |
| `ledger_accounts` | Wallets (per user) and holdings (per escrow)         |
| `ledger_entries`  | Append-only double-entry money movements             |

Reads and writes go through `lib/transactions.ts`. Each action runs inside a single SQLite
transaction that validates, updates the row and appends the event, so a rejected action leaves no
partial write and two concurrent releases cannot both succeed.

The database lives at `data/venn.db` (override with `VENN_DB_FILE`).

## HTTP API

All routes resolve the actor from the `venn_session` cookie and enforce the state machine. Without
a valid session they return `401`.

| Method | Path                          | Purpose                                  |
| ------ | ----------------------------- | ---------------------------------------- |
| GET    | `/api/health`                 | Liveness and transaction count           |
| GET    | `/api/transactions`           | Transactions the actor is a party to     |
| POST   | `/api/transactions`           | Buyer opens a new escrow                 |
| GET    | `/api/transactions/[id]`      | One transaction plus its event trail     |
| PATCH  | `/api/transactions/[id]`      | Run one action: `{ "action": "dispatch", ... }` |

Actions: `dispatch`, `scan_in_transit`, `confirm_delivery`, `release_funds`, `open_dispute`,
`resolve_dispute`. Errors carry a machine-readable `code` and map to `400`, `403`, `404`, or `409`.

## Not yet built

- **Real payment gateway**: `depositWalletFunds` mints wallet credit from a demo rail. Wire it to
  Stripe/M-Pesa/ACH and the rest of the ledger, escrow accounting and payouts already work.
- **Session hardening**: a login rate limiter, session revocation lists, and email verification
  should precede production use.
- **Ledger scalability**: balances are `SUM` over entries, which is fine for a marketplace MVP but
  not for high volume; add cursor-paginated reads and a balances table before scale.

Notably, the escrow state machine, role authorization, the audit trail and the double-entry ledger
are all real and tested — the pieces above are operational, not conceptual, gaps.