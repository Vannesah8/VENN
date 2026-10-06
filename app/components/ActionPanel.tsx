"use client";

import { useActionState } from "react";

import { runEscrowAction } from "@/app/actions";
import { IDLE_ACTION_STATE } from "@/lib/action-state";

export interface CarrierOption {
  id: string;
  displayName: string;
}

export interface PendingAction {
  action: string;
  label: string;
  description: string;
  to: string;
}

const NEEDS_SHIPMENT_DETAILS = new Set(["dispatch"]);

export function ActionPanel({
  transactionId,
  actions,
  carriers,
}: {
  transactionId: string;
  actions: PendingAction[];
  carriers: CarrierOption[];
}) {
  const [state, formAction, pending] = useActionState(runEscrowAction, IDLE_ACTION_STATE);

  if (actions.length === 0) {
    return (
      <p className="rounded-2xl border border-[#edf3ee] bg-[#f8faf8] p-4 text-sm text-[#5d736a]">
        No actions are available to you on this transaction right now.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {state.error ? (
        <p
          role="alert"
          className="rounded-2xl border border-[#e3c98a] bg-[#fbf3e2] px-4 py-3 text-sm text-[#8a5a12]"
        >
          {state.error}
        </p>
      ) : null}

      {actions.map((item) => {
        const needsDetails = NEEDS_SHIPMENT_DETAILS.has(item.action);

        return (
          <form
            key={item.action}
            action={formAction}
            className="rounded-2xl border border-[#edf3ee] bg-[#f8faf8] p-4"
          >
            <input type="hidden" name="transactionId" value={transactionId} />
            <input type="hidden" name="action" value={item.action} />

            <p className="font-medium text-[#18352d]">{item.label}</p>
            <p className="mt-1 text-sm text-[#5d736a]">{item.description}</p>

            {needsDetails ? (
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <label className="text-sm text-[#5d736a]">
                  Tracking number
                  <input
                    name="trackingNumber"
                    required
                    placeholder="1Z9V94X7K9"
                    className="mt-1 w-full rounded-xl border border-[#dfece5] bg-white px-3 py-2 text-sm text-[#18352d]"
                  />
                </label>

                <label className="text-sm text-[#5d736a]">
                  Carrier
                  <input
                    name="carrierName"
                    required
                    placeholder="FedEx"
                    className="mt-1 w-full rounded-xl border border-[#dfece5] bg-white px-3 py-2 text-sm text-[#18352d]"
                  />
                </label>

                <label className="text-sm text-[#5d736a]">
                  Carrier account
                  <select
                    name="carrierId"
                    required
                    defaultValue=""
                    className="mt-1 w-full rounded-xl border border-[#dfece5] bg-white px-3 py-2 text-sm text-[#18352d]"
                  >
                    <option value="" disabled>
                      Select carrier
                    </option>
                    {carriers.map((carrier) => (
                      <option key={carrier.id} value={carrier.id}>
                        {carrier.displayName}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="grid grid-cols-2 gap-3">
                  <label className="text-sm text-[#5d736a]">
                    Origin
                    <input
                      name="origin"
                      required
                      placeholder="Lagos"
                      className="mt-1 w-full rounded-xl border border-[#dfece5] bg-white px-3 py-2 text-sm text-[#18352d]"
                    />
                  </label>
                  <label className="text-sm text-[#5d736a]">
                    Destination
                    <input
                      name="destination"
                      required
                      placeholder="Nairobi"
                      className="mt-1 w-full rounded-xl border border-[#dfece5] bg-white px-3 py-2 text-sm text-[#18352d]"
                    />
                  </label>
                </div>
              </div>
            ) : (
              <label className="mt-4 block text-sm text-[#5d736a]">
                Note {item.action === "open_dispute" ? "(required for the case file)" : "(optional)"}
                <input
                  name="note"
                  required={item.action === "open_dispute"}
                  placeholder={
                    item.action === "open_dispute"
                      ? "Item arrived damaged"
                      : "Added context for the audit trail"
                  }
                  className="mt-1 w-full rounded-xl border border-[#dfece5] bg-white px-3 py-2 text-sm text-[#18352d]"
                />
              </label>
            )}

            <button
              type="submit"
              disabled={pending}
              className="mt-4 rounded-full bg-[#1e4d3d] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#123a30] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {pending ? "Working..." : item.label}
            </button>
          </form>
        );
      })}
    </div>
  );
}