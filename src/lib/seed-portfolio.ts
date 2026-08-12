/**
 * Ögonblicksbilden 2026-08-12 — referensportföljen som verifieringssviten
 * i payoff.verify.test.ts räknar mot. Samma siffror som ligger i databasen.
 */
import type { Loan } from "@/lib/payoff";

const base = {
  kind: "privatlan" as const,
  has_collateral: false,
  is_revolving: false,
  original_amount: null,
  credit_limit: null,
  min_payment_pct: null,
  payment_day: null,
  interest_daily: false,
};

export const SNAPSHOT_DATE = new Date(Date.UTC(2026, 7, 12));

export const REFERENCE_LOANS: Loan[] = [
  { ...base, id: "brocc", name: "Brocc", current_balance: 325773.4, nominal_rate: 13.73, min_payment: 4470, monthly_fee: 0 },
  { ...base, id: "nordax", name: "Nordax 100100196602", current_balance: 54045.28, nominal_rate: 18.99, min_payment: 2469.01, monthly_fee: 0 },
  { ...base, id: "northmill", name: "Northmill kontokredit", kind: "kontokredit", is_revolving: true, credit_limit: 50000, current_balance: 46138, nominal_rate: 16.3, min_payment: 1608, monthly_fee: 330 },
  { ...base, id: "bn002", name: "BN 10697772002", current_balance: 15397.26, nominal_rate: 19.99, min_payment: 920, monthly_fee: 35 },
  { ...base, id: "coll507", name: "Collector 3850290507", current_balance: 14036.59, nominal_rate: 17.65, min_payment: 991, monthly_fee: 35 },
  { ...base, id: "bn004", name: "BN 10697772004", current_balance: 13972.34, nominal_rate: 18.99, min_payment: 833.56, monthly_fee: 35 },
  { ...base, id: "coll801", name: "Collector 3863741801", current_balance: 13090.98, nominal_rate: 16.2, min_payment: 824, monthly_fee: 30 },
  { ...base, id: "bn005", name: "BN 10697772005", current_balance: 10000, nominal_rate: 17.49, min_payment: 600, monthly_fee: 35 },
  { ...base, id: "brixo", name: "Brixo kontokredit", kind: "kontokredit", is_revolving: true, current_balance: 8527.32, nominal_rate: 22.7, min_payment: 400, min_payment_pct: 4, monthly_fee: 0 },
  { ...base, id: "bn003", name: "BN 10697772003", current_balance: 8160.75, nominal_rate: 18.5, min_payment: 354.16, monthly_fee: 35 },
];

/** De sju små krediterna som kapitalinsatsscenariot löser. */
export const SMALL_SEVEN = ["brixo", "bn002", "bn003", "bn004", "bn005", "coll507", "coll801"];
