import type { Transaction } from "@/lib/data";

export interface RecurringPaymentCandidate {
  key: string;
  label: string;
  monthlyAmount: number;
  annualAmount: number;
  monthsSeen: number;
  lastSeen: string;
  confidence: "hög" | "medel";
}

export interface FinancialVitals {
  fixedLoadPct: number;
  runwayMonths: number | null;
  dailyInterestBurn: number;
  monthlyLocked: number;
  freeAfterLocked: number;
}

function monthKey(iso: string): string {
  return iso.slice(0, 7);
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export function normalizeMerchant(value: string | null | undefined): string {
  return (value ?? "okänd")
    .toLocaleLowerCase("sv-SE")
    .replace(/\b\d{4,}\b/g, "")
    .replace(/[^a-zåäö0-9 ]/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 60);
}

/**
 * Hittar sannolika månatliga dragningar utan att automatiskt kalla dem
 * "onödiga". Kandidaterna är beslutsunderlag och behöver bekräftas av användaren.
 */
export function detectRecurringPayments(transactions: Transaction[]): RecurringPaymentCandidate[] {
  const groups = new Map<string, Transaction[]>();

  for (const transaction of transactions) {
    if (transaction.amount >= 0) continue;
    const source = transaction.raw_description || transaction.description;
    const key = normalizeMerchant(source);
    if (!key || key === "okänd") continue;
    const rows = groups.get(key) ?? [];
    rows.push(transaction);
    groups.set(key, rows);
  }

  const candidates: RecurringPaymentCandidate[] = [];
  for (const [key, rows] of groups) {
    const byMonth = new Map<string, Transaction>();
    for (const row of rows.sort((a, b) => a.occurred_at.localeCompare(b.occurred_at))) {
      byMonth.set(monthKey(row.occurred_at), row);
    }
    const monthlyRows = [...byMonth.values()];
    if (monthlyRows.length < 2) continue;

    const amounts = monthlyRows.map((row) => Math.abs(row.amount));
    const typical = median(amounts);
    if (typical <= 0) continue;
    const stable = amounts.filter((value) => Math.abs(value - typical) / typical <= 0.15).length;
    if (stable < Math.min(2, monthlyRows.length)) continue;

    const latest = monthlyRows.at(-1)!;
    candidates.push({
      key,
      label: latest.description || latest.raw_description || key,
      monthlyAmount: Math.round(typical),
      annualAmount: Math.round(typical * 12),
      monthsSeen: monthlyRows.length,
      lastSeen: latest.occurred_at,
      confidence: monthlyRows.length >= 3 && stable / monthlyRows.length >= 0.75 ? "hög" : "medel",
    });
  }

  return candidates
    .sort((a, b) => b.monthlyAmount - a.monthlyAmount)
    .slice(0, 12);
}

export function financialVitals(input: {
  plannedIncome: number;
  fixedPlannedExpense: number;
  minimumDebtPayments: number;
  liquidSavings: number;
  monthlyInterestAndFees: number;
}): FinancialVitals {
  const income = Math.max(0, input.plannedIncome);
  const monthlyLocked = Math.max(0, input.fixedPlannedExpense) + Math.max(0, input.minimumDebtPayments);
  const fixedLoadPct = income > 0 ? (monthlyLocked / income) * 100 : 0;
  const runwayMonths = monthlyLocked > 0 ? Math.max(0, input.liquidSavings) / monthlyLocked : null;

  return {
    fixedLoadPct,
    runwayMonths,
    dailyInterestBurn: Math.max(0, input.monthlyInterestAndFees) / 30.4,
    monthlyLocked,
    freeAfterLocked: income - monthlyLocked,
  };
}

export function shockRunway(input: {
  liquidSavings: number;
  monthlyLocked: number;
  shock: number;
}): number | null {
  if (input.monthlyLocked <= 0) return null;
  return Math.max(0, input.liquidSavings - Math.max(0, input.shock)) / input.monthlyLocked;
}
