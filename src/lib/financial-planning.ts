import type { Loan } from "@/lib/payoff";
import { minimumPayment } from "@/lib/payoff";
import type { SinkingFund } from "@/lib/sinking";
import {
  activeCommitments,
  type FinancialCommitment,
} from "@/lib/commitments";

const DAY_MS = 86_400_000;

function toUTCDate(iso: string): Date {
  return new Date(`${iso.slice(0, 10)}T00:00:00Z`);
}

function iso(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addDays(isoDate: string, days: number): string {
  return iso(new Date(toUTCDate(isoDate).getTime() + days * DAY_MS));
}

function dayOfMonth(isoDate: string): number {
  return toUTCDate(isoDate).getUTCDate();
}

function daysInMonth(isoDate: string): number {
  const d = toUTCDate(isoDate);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
}

function occursOnDay(requested: number | null, isoDate: string): boolean {
  if (!requested) return false;
  return dayOfMonth(isoDate) === Math.min(requested, daysInMonth(isoDate));
}

export type CashflowEventKind = "income" | "commitment" | "debt" | "annual";

export interface CashflowEvent {
  date: string;
  label: string;
  amount: number;
  kind: CashflowEventKind;
}

export interface CashflowPoint {
  date: string;
  balance: number;
}

export interface CashflowForecast {
  points: CashflowPoint[];
  events: CashflowEvent[];
  lowestBalance: number;
  lowestDate: string;
  endBalance: number;
  unplacedMonthly: number;
}

export function buildCashflowForecast(input: {
  today: string;
  days?: number;
  startingBalance: number;
  monthlyIncome: number;
  payday: number;
  commitments: FinancialCommitment[];
  loans: Loan[];
  sinkingFunds: SinkingFund[];
}): CashflowForecast {
  const horizon = Math.max(1, Math.min(365, input.days ?? 90));
  const events: CashflowEvent[] = [];
  const points: CashflowPoint[] = [];
  let balance = input.startingBalance;
  let lowestBalance = balance;
  let lowestDate = input.today;

  const unplacedCommitments = activeCommitments(input.commitments, input.today)
    .filter((item) => !item.payment_day)
    .reduce((sum, item) => sum + item.monthly_amount, 0);
  const unplacedDebt = input.loans
    .filter((loan) => loan.current_balance > 0 && !loan.payment_day)
    .reduce(
      (sum, loan) => sum + minimumPayment(loan, loan.current_balance) + (loan.monthly_fee ?? 0),
      0,
    );

  for (let index = 0; index < horizon; index += 1) {
    const date = addDays(input.today, index);

    if (input.monthlyIncome > 0 && occursOnDay(input.payday, date)) {
      balance += input.monthlyIncome;
      events.push({ date, label: "Planerad månadsinkomst", amount: input.monthlyIncome, kind: "income" });
    }

    for (const commitment of activeCommitments(input.commitments, date)) {
      if (!occursOnDay(commitment.payment_day, date)) continue;
      balance -= commitment.monthly_amount;
      events.push({
        date,
        label: commitment.name,
        amount: -commitment.monthly_amount,
        kind: "commitment",
      });
    }

    for (const loan of input.loans) {
      if (loan.current_balance <= 0 || !occursOnDay(loan.payment_day, date)) continue;
      const amount = minimumPayment(loan, loan.current_balance) + (loan.monthly_fee ?? 0);
      balance -= amount;
      events.push({ date, label: loan.name, amount: -amount, kind: "debt" });
    }

    for (const fund of input.sinkingFunds) {
      if (!fund.next_expected || fund.next_expected !== date) continue;
      balance -= fund.annual_estimate;
      events.push({ date, label: fund.name, amount: -fund.annual_estimate, kind: "annual" });
    }

    const rounded = Math.round(balance);
    points.push({ date, balance: rounded });
    if (rounded < lowestBalance) {
      lowestBalance = rounded;
      lowestDate = date;
    }
  }

  return {
    points,
    events: events.sort((a, b) => a.date.localeCompare(b.date)),
    lowestBalance: Math.round(lowestBalance),
    lowestDate,
    endBalance: Math.round(balance),
    unplacedMonthly: Math.round(unplacedCommitments + unplacedDebt),
  };
}

export interface StressTestResult {
  balanceAfterShock: number;
  monthlyIncomeAfterDrop: number;
  monthlyGap: number;
  runwayMonths: number | null;
}

export function stressTest(input: {
  liquidSavings: number;
  monthlyIncome: number;
  essentialMonthly: number;
  shock: number;
  incomeDropPct: number;
}): StressTestResult {
  const balanceAfterShock = Math.max(0, input.liquidSavings - Math.max(0, input.shock));
  const drop = Math.min(100, Math.max(0, input.incomeDropPct));
  const monthlyIncomeAfterDrop = Math.max(0, input.monthlyIncome * (1 - drop / 100));
  const monthlyGap = Math.max(0, input.essentialMonthly - monthlyIncomeAfterDrop);
  const runwayMonths = monthlyGap > 0 ? balanceAfterShock / monthlyGap : null;
  return {
    balanceAfterShock: Math.round(balanceAfterShock),
    monthlyIncomeAfterDrop: Math.round(monthlyIncomeAfterDrop),
    monthlyGap: Math.round(monthlyGap),
    runwayMonths: runwayMonths == null ? null : Math.round(runwayMonths * 10) / 10,
  };
}

export interface AllocationPreview {
  saving: number;
  debt: number;
  everyday: number;
}

export function allocationPreview(
  surplus: number,
  savingPct: number,
  everydayPct: number,
): AllocationPreview {
  const value = Math.max(0, surplus);
  const savingShare = Math.min(100, Math.max(0, savingPct));
  const everydayShare = Math.min(100 - savingShare, Math.max(0, everydayPct));
  const saving = Math.round((value * savingShare) / 100);
  const everyday = Math.round((value * everydayShare) / 100);
  return {
    saving,
    everyday,
    debt: Math.max(0, Math.round(value - saving - everyday)),
  };
}

export function monthsBetween(fromISO: string, toISO: string): number {
  const from = toUTCDate(fromISO);
  const to = toUTCDate(toISO);
  return Math.max(
    0,
    (to.getUTCFullYear() - from.getUTCFullYear()) * 12 + to.getUTCMonth() - from.getUTCMonth(),
  );
}
