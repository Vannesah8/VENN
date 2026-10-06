import type { EscrowParty, EscrowRole, EscrowStatus } from "@/lib/escrow";
import { getEscrowStatusLabel, getEscrowStatusTone } from "@/lib/escrow";

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

const signedCurrencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  signDisplay: "always",
});

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "UTC",
});

export function formatCents(cents: number): string {
  return currencyFormatter.format(cents / 100);
}

export function formatSignedCents(cents: number): string {
  return signedCurrencyFormatter.format(cents / 100);
}

export function formatDate(date: Date): string {
  return dateFormatter.format(date);
}

export function statusLabel(status: EscrowStatus): string {
  return getEscrowStatusLabel(status);
}

export function statusTone(status: EscrowStatus): string {
  return getEscrowStatusTone(status);
}

export function roleLabel(role: EscrowRole): string {
  switch (role) {
    case "buyer":
      return "Buyer";
    case "seller":
      return "Seller";
    case "carrier":
      return "Carrier";
    case "mediator":
      return "Support";
  }
}

export function partySentence(party: EscrowParty): string {
  switch (party) {
    case "buyer":
      return "You are the buyer on this transaction.";
    case "seller":
      return "You are the seller on this transaction.";
    case "carrier":
      return "You are the assigned carrier on this transaction.";
    case "mediator":
      return "You are acting as support on this transaction.";
  }
}

export function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}