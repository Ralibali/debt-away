/**
 * Nettoförmögenhet över tid — historik ur faktiska avstämningar och
 * registrerade lånebetalningar, projektion ur avbetalningsmotorn.
 * Ingen fantasi: saknas data ritas ingen historik.
 */

import { simulate, type Loan, type Strategy } from "@/lib/payoff";
import type { SavingsSnapshot } from "@/lib/savings";

export interface NetPoint {
  /** YYYY-MM-01 */
  date: string;
  /** Skuld som negativt tal (yta under nollinjen) */
  debt: number;
  /** Sparande som positivt tal */
  saving: number;
  net: number;
  projected: boolean;
}

export interface CrossoverSeries {
  points: NetPoint[];
  todayIndex: number;
  netToday: number;
  /** Månaden då nettot passerar noll, YYYY-MM-01 */
  crossoverDate: string | null;
  monthsToCrossover: number | null;
}

function monthKey(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-01`;
}

function addMonths(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + n);
  return monthKey(d);
}

export interface CrossoverInput {
  loans: Loan[];
  snapshots: SavingsSnapshot[];
  /** Principaldel per månad (YYYY-MM-01 → belopp) ur registrerade betalningar */
  principalByMonth: Record<string, number>;
  monthlyDeposits: number;
  extraPerMonth: number;
  strategy: Strategy;
  /** Antal månader historik att visa */
  historyMonths?: number;
  horizonMonths?: number;
}

/**
 * Bygger en kontinuerlig tidsaxel: skuld under noll, sparande över noll.
 * Historiken rekonstrueras bakåt från dagens saldon med faktiska
 * amorteringar respektive avstämningar.
 */
export function crossoverSeries(input: CrossoverInput): CrossoverSeries {
  const {
    loans,
    snapshots,
    principalByMonth,
    monthlyDeposits,
    extraPerMonth,
    strategy,
    historyMonths = 12,
    horizonMonths = 120,
  } = input;

  const today = monthKey(new Date());
  const debtToday = loans.reduce((s, l) => s + Math.max(0, l.current_balance), 0);
  const savingToday = latestSavingTotal(snapshots);

  const points: NetPoint[] = [];

  // --- historik, bakåt från idag
  let debtCursor = debtToday;
  const history: NetPoint[] = [];
  for (let i = 0; i < historyMonths; i++) {
    const date = addMonths(today, -i);
    const saving = savingTotalOn(snapshots, date);
    history.push({
      date,
      debt: -debtCursor,
      saving,
      net: saving - debtCursor,
      projected: false,
    });
    // månaden före hade högre skuld med den amortering som gjordes denna månad
    debtCursor += principalByMonth[date] ?? 0;
  }
  history.reverse();
  // klipp bort ledande månader helt utan data
  const firstReal = history.findIndex((p) => p.saving > 0 || p.debt !== 0);
  points.push(...(firstReal > 0 ? history.slice(firstReal) : history));

  const todayIndex = points.length - 1;

  // --- projektion, ur avbetalningsmotorn
  const sim = simulate(loans, extraPerMonth, strategy);
  let saving = savingToday;
  for (let m = 1; m <= horizonMonths; m++) {
    const row = sim.schedule[m - 1];
    const debt = row ? row.totalBalance : 0;
    saving += monthlyDeposits;
    const date = addMonths(today, m);
    points.push({ date, debt: -debt, saving, net: saving - debt, projected: true });
    if (debt <= 0.005 && m > 1 && saving - debt > 0) {
      // fortsätt ändå några månader efter korspunkten för kontext
      if (points.filter((p) => p.projected && p.net > 0).length >= 6) break;
    }
  }

  const cross = points.find((p, i) => p.net >= 0 && i >= todayIndex);
  const crossoverDate = cross ? cross.date : null;
  const monthsToCrossover = cross ? points.indexOf(cross) - todayIndex : null;

  return {
    points,
    todayIndex,
    netToday: (points[todayIndex]?.net ?? savingToday - debtToday),
    crossoverDate,
    monthsToCrossover: monthsToCrossover != null && monthsToCrossover > 0 ? monthsToCrossover : 0,
  };
}

function savingTotalOn(snapshots: SavingsSnapshot[], dateISO: string): number {
  const end = addMonths(dateISO, 1);
  const byAccount = new Map<string, number>();
  for (const s of snapshots) {
    if (s.snapshot_date < end) byAccount.set(s.account_id, s.value);
  }
  return [...byAccount.values()].reduce((a, b) => a + b, 0);
}

function latestSavingTotal(snapshots: SavingsSnapshot[]): number {
  const byAccount = new Map<string, number>();
  for (const s of snapshots) byAccount.set(s.account_id, s.value);
  return [...byAccount.values()].reduce((a, b) => a + b, 0);
}
