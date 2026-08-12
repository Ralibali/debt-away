/**
 * Den dagliga siffran: kvar att spendera den här fasen, och per dag.
 *
 * kvar = saldo på lönekonto
 *      − obetalda räkningar före nästa lön
 *      − minimibetalningar på lån
 *      − månadens kvarvarande avsättning till buffertposter
 *      − planerat extrabelopp till skulden
 *
 * Ingen språkmodell är inblandad. Varje post redovisas separat så att siffran
 * går att ta isär.
 */

import type { Account, Budget, Category, Transaction } from "@/lib/data";
import { minimumPayment, type Loan } from "@/lib/payoff";
import { DEFAULT_PARAMETERS, type UserParameters } from "@/lib/parameters";
import {
  nextMonthDay,
  nextPhaseWindow,
  phaseWindow,
  type CareSchedule,
  type Phase,
  type PhaseWindow,
} from "@/lib/phase";
import { remainingAccrualThisMonth, type SinkingFund } from "@/lib/sinking";

export interface PhaseBudget {
  id: string;
  category_id: string;
  phase: Phase;
  planned: number;
}

export interface DailyInput {
  accounts: Account[];
  loans: Loan[];
  categories: Category[];
  /** Månadens budgetposter, används för att hitta obetalda fasta räkningar */
  budgets: Budget[];
  /** Månadens transaktioner */
  transactions: Transaction[];
  funds: SinkingFund[];
  phaseBudgets: PhaseBudget[];
  /** Planerat extrabelopp till skulden den här månaden */
  extraToDebt: number;
  schedule: CareSchedule;
  today: string;
  params?: UserParameters;
}

export interface DailyPart {
  label: string;
  amount: number;
  note?: string;
}

export interface DailyNumber {
  window: PhaseWindow;
  next: PhaseWindow;
  balance: number;
  parts: DailyPart[];
  /** Kvar att spendera resten av fasen */
  remaining: number;
  daysLeft: number;
  perDay: number;
  /** Ungefärligt behov för nästa fas, från fasbudgeten */
  nextPhaseNeed: number;
  /** Sant när nästa fas är dyrare än det som blir över */
  nextPhaseIsHeavier: boolean;
  nextPayday: string;
}

/** Fasta räkningar som är budgeterade men ännu inte syns som transaktion. */
export function unpaidFixedBills(
  categories: Category[],
  budgets: Budget[],
  transactions: Transaction[],
): number {
  const fixed = new Set(
    categories.filter((c) => c.kind === "utgift" && c.is_fixed).map((c) => c.id),
  );
  const paid = new Map<string, number>();
  for (const t of transactions) {
    if (!t.category_id || !fixed.has(t.category_id)) continue;
    paid.set(t.category_id, (paid.get(t.category_id) ?? 0) + Math.abs(t.amount));
  }
  let sum = 0;
  for (const b of budgets) {
    if (!fixed.has(b.category_id)) continue;
    sum += Math.max(0, b.planned - (paid.get(b.category_id) ?? 0));
  }
  return Math.round(sum);
}

export function phaseBudgetTotal(phaseBudgets: PhaseBudget[], phase: Phase): number {
  return phaseBudgets.filter((p) => p.phase === phase).reduce((s, p) => s + p.planned, 0);
}

export function computeDaily(input: DailyInput): DailyNumber {
  const p = input.params ?? DEFAULT_PARAMETERS;
  const window = phaseWindow(input.today, input.schedule);
  const next = nextPhaseWindow(input.today, input.schedule);

  const salaryAccounts = input.accounts.filter((a) => a.kind === "lonekonto");
  const balance = (salaryAccounts.length ? salaryAccounts : input.accounts).reduce(
    (s, a) => s + a.balance,
    0,
  );

  const bills = unpaidFixedBills(input.categories, input.budgets, input.transactions);
  const minimums = Math.round(
    input.loans.reduce(
      (s, l) => s + minimumPayment(l, l.current_balance) + (l.monthly_fee ?? 0),
      0,
    ),
  );
  const accrual = remainingAccrualThisMonth(input.funds, input.today);
  const extra = Math.max(0, Math.round(input.extraToDebt));

  const parts: DailyPart[] = [
    { label: "Obetalda räkningar före nästa lön", amount: -bills },
    { label: "Minimibetalningar på lån", amount: -minimums },
    { label: "Avsättning till buffertposter", amount: -accrual, note: "resten av månaden" },
    { label: "Planerat extra till skulden", amount: -extra },
  ];

  const remaining = Math.round(balance - bills - minimums - accrual - extra);
  const daysLeft = Math.max(1, window.daysLeft);
  const nextPhaseNeed = Math.round(phaseBudgetTotal(input.phaseBudgets, next.phase));

  return {
    window,
    next,
    balance: Math.round(balance),
    parts,
    remaining,
    daysLeft,
    perDay: Math.round(remaining / daysLeft),
    nextPhaseNeed,
    nextPhaseIsHeavier: nextPhaseNeed > 0 && nextPhaseNeed > Math.max(0, remaining),
    nextPayday: nextMonthDay(input.today, p.payday, false),
  };
}

/** Text som gör intecknandet explicit, utan värdering. */
export function nextPhaseNote(d: DailyNumber): string | null {
  if (d.nextPhaseNeed <= 0) return null;
  const label = d.next.phase === "barnvecka" ? "barnvecka" : "ensamvecka";
  return `Nästa ${label} börjar ${d.next.start} och är budgeterad till ${Math.round(
    d.nextPhaseNeed,
  ).toLocaleString("sv-SE")} kr.`;
}
